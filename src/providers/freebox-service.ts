import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import * as CryptoJS from 'crypto-js';
import { CommonService } from './common-service';
import { DownloadModel } from '../models/download.model';
import 'rxjs/add/operator/map';

@Injectable()
export class FreeboxService {
    private isIliadbox: any; // boolean?
    private urlBase: any;
    private routeApi: any;
    private appId: any = 'fr.freebox.torrent';
    private routeAuth: any;
    private routeTracking: any;
    private routeLogin: any;
    private routeLoginSession: any;
    private routeDownloads: any;
    //private routeDownload: any;
    private routeDownloadDelete: any;
    private routeDownloadStatus: any;
    private routeDownloadAddByUrl: any;

    constructor(public http: HttpClient, public commonService: CommonService) {
        // iliadbox/freebox check
        this.isIliadbox = commonService.isIliadbox();
        this.urlBase = this.isIliadbox
            ? 'http://myiliadbox.iliad.it/'
            : 'http://fwed.freeboxos.fr:8000/';

        // API version
        this.routeApi = this.urlBase + 'api/v8/';

        // REST API routes
        this.routeAuth = this.routeApi + 'login/authorize/';
        this.routeTracking = this.routeApi + 'login/authorize/';
        this.routeLogin = this.routeApi + 'login/';
        this.routeLoginSession = this.routeApi + 'login/session/';
        this.routeDownloads = this.routeApi + 'downloads/';

        //this.routeDownload = this.routeApi + 'freebox/download';
        this.routeDownloadDelete = this.routeApi + 'freebox/download/delete';
        this.routeDownloadStatus = this.routeApi + 'freebox/download/status';
        this.routeDownloadAddByUrl = this.routeApi + 'downloads/add';
        //this.routeDownloads = this.routeApi + 'downloads/';
        //this.routeAirMedia = this.routeApi + 'airmedia/receivers/';
    }

    auth() {
        return new Promise(resolve => {
            let request: any = {
                "app_id": this.appId,
                "app_name": "TorrentFreebox",
                "app_version": "0.0.2",
                "device_name": "Gally"
            };
            let param:any = JSON.stringify(request);
            this.http.post(this.routeAuth, param)
                .subscribe(
                    response => {
                        if (response['success']) {
                            this.commonService.setToken(response['result']['app_token']).then(setToken => {
                                if (setToken) {
                                    this.commonService.setTrackId(response['result']['track_id']).then(setTrackId => {
                                        if (setTrackId) {
                                            resolve(true);
                                        } else {
                                            resolve(false);
                                        }
                                    });
                                } else {
                                    resolve(false);
                                }
                            });
                        } else {
                            resolve(false);
                        }
                    },
                    err => {
                        resolve(false);
                    }
                );
        });
    }

    getStatus() {
        return new Promise(resolve => {
            this.commonService.getTrackId().then(trackId => {
                if (!trackId) {
                    resolve('errorTrackId');
                } else {
                    this.http.get(this.routeTracking + trackId)
                        .subscribe(
                            response => {
                                if (response['success']) {
                                    let status:any = response['result']['status'];
                                    if ( status == 'granted') {
                                        this.commonService.setGranted(true).then(granted => {
                                            if (granted) {
                                                resolve(status);
                                            } else {
                                                resolve('errorSet');
                                            }
                                        });
                                    } else {
                                        resolve(status);
                                    }
                                } else {
                                    resolve('errorCall');
                                }
                            },
                            err => {
                                resolve('errorInternal');
                            }
                        );
                }
            });


        });
    }

    challenge() {
        return new Promise(resolve => {
            let header = new HttpHeaders().set('Content-Type', 'application/x-www-form-urlencoded');
            const reqOpts = {
                headers: header
            };
            this.http.get(this.routeLogin, reqOpts)
                .subscribe(
                    response => {
                        if (response['success']) {
                            let challenge: any = response['result']['challenge'];
                            this.commonService.getToken().then(token => {
                                let password: any = CryptoJS.HmacSHA1(challenge, token);
                                let encPassword: any = password.toString(CryptoJS.enc.Hex);
                                this.loginSession(encPassword).then(loginSession => {
                                    resolve(loginSession);
                                });
                            });
                        } else {
                            resolve(false);
                        }
                    },
                    err => {
                        resolve(false);
                    }
                );
        });
    }

    loginSession(password) {
        return new Promise(resolve => {
            let request: any = {
                "app_id": this.appId,
                "password": password
            };
            let param:any = JSON.stringify(request);
            let header = new HttpHeaders().set('Content-Type', 'application/x-www-form-urlencoded');
            const reqOpts = {
                headers: header
            };
            this.http.post(this.routeLoginSession, param, reqOpts)
                .subscribe(
                    response => {
                        if (response['success']) {
                            this.commonService.setTokenSession(response['result']['session_token']).then(set => {
                                resolve(response['result']['session_token']);
                            });

                        } else {
                            this.commonService.removeTokenSession().then(() => {
                                resolve(false);
                            });
                        }
                    },
                    () => {
                        this.commonService.removeTokenSession().then(() => {
                            resolve(false);
                        });
                    }
                );
        });
    }

    getDownloads() {
        return new Promise(resolve => {
            this.commonService.getTokenSession().then(tokenSession => {
                if (tokenSession) {
                    this.getDownloadsGranted(tokenSession).then(downloads => {
                        if (!downloads) {
                            this.challenge().then(tokenSession => {
                                if (tokenSession) {
                                    this.getDownloadsGranted(tokenSession).then(downloads => {
                                        resolve(downloads);
                                    });
                                } else {
                                    resolve(false);
                                }
                            });
                        } else {
                            resolve(downloads);
                        }
                    });
                } else {
                    this.challenge().then(tokenSession => {
                        if (tokenSession) {
                            this.getDownloadsGranted(tokenSession).then(downloads => {
                                resolve(downloads);
                            });
                        } else {
                            resolve(false);
                        }
                    });
                }
            });

        });
    }

    getDownloadsGranted(tokenSession) {
        return new Promise(resolve => {
            let header = new HttpHeaders()
                .set('Content-Type', 'application/x-www-form-urlencoded')
                .set('X-Fbx-App-Auth', tokenSession);
            const reqOpts = {
                headers: header
            };
            this.http.get(this.routeDownloads, reqOpts)
                .subscribe(
                    response => {
                        if (response['success']) {
                            let downloads:any = [];
                            if (response['result'] != undefined) {
                                // todo
                                let isFrench: boolean = false;

                                // Labels for sizes
                                const byteLabel: string = isFrench ? 'o' : 'b';
                                const kilobyteLabel: string = isFrench ? 'Ko' : 'kB';
                                const megabyteLabel: string = isFrench ? 'Mo' : 'MB';
                                const gigabyteLabel: string = isFrench ? 'Go' : 'GB';

                                // Labels for intervals
                                const secondsLabel = 'sec';
                                const minutesLabel = 'mn';
                                const hoursLabel = 'h';
                                const daysLabel = 'j';

                                for (let entry of response['result']) {
                                    let size: any = '';
                                    if (entry['size'] < 1000000 ) {
                                        size = (entry['size'] / 1000) + ' ' + kilobyteLabel;
                                    } else if (entry['size'] < 1000000000 ) {
                                        size = (entry['size'] / 1000000) + ' ' + megabyteLabel;
                                    } else {
                                        size = (entry['size'] / 1000000000) + ' ' + gigabyteLabel;
                                    }
                                    let progress:number = Math.ceil((entry['rx_pct'] / 100));
                                    if (entry['rx_bytes'] < entry['size']) {
                                        progress = Math.ceil(((entry['rx_bytes'] / entry['size']) * 100));
                                    }
                                    let remainingTime:any = '';
                                    let speed:any = '';
                                    let icon: string = 'play';
                                    let downloadStatus: boolean = false;
                                    let checkingStatus: boolean = false;
                                    let shareStatus: boolean = false;
                                    if ((entry['rx_pct'] = 10000
                                            || entry['status']=='seeding')
                                            && (entry['rx_bytes']==entry['size'])) {
                                        shareStatus = true;
                                        if (entry['tx_rate'] < 1000 ) {
                                            speed = entry['tx_rate'] + ' ' + byteLabel + '/s';
                                        } else if (entry['tx_rate'] < 1000000 ) {
                                            speed = Math.ceil(entry['tx_rate'] / 1000) + ' ' + kilobyteLabel + '/s';
                                        } else {
                                            speed = (Math.round((entry['tx_rate'] / 1000000 + Number.EPSILON) * 10) / 10) + ' ' + megabyteLabel + '/s';
                                        }
                                        progress = Math.ceil((entry['tx_pct'] / 100));
                                    }
                                    if (entry['status']=='downloading' || (entry['rx_bytes']<entry['size'])) {
                                        downloadStatus = true;
                                        shareStatus = false;
                                        if (entry['status']=='downloading') {
                                            icon = 'play';
                                        } else {
                                            icon = 'pause';
                                        }
                                        if (entry['eta'] < 60 ) {
                                            remainingTime = entry['eta'] + ' ' + secondsLabel;
                                        } else if (entry['eta'] < 3600 ) {
                                            remainingTime = Math.ceil(entry['eta'] / 60) + ' ' + minutesLabel;
                                        } else if (entry['eta'] < 86400 ) {
                                            remainingTime = Math.ceil(entry['eta'] / 3600) + ' ' + hoursLabel;
                                        } else {
                                            remainingTime = Math.ceil(entry['eta'] / 86400) + ' ' + daysLabel;
                                        }
                                        if (entry['rx_rate'] < 1000 ) {
                                            speed = entry['rx_rate'] + ' ' + byteLabel + '/s';
                                        } else if (entry['rx_rate'] < 1000000 ) {
                                            speed = Math.ceil(entry['rx_rate'] / 1000) + ' ' + kilobyteLabel + '/s';
                                        } else {
                                            speed = (Math.round((entry['rx_rate'] / 1000000 + Number.EPSILON) * 10) / 10) + ' ' + megabyteLabel + '/s';
                                        }
                                    }
                                    if (entry['status']=='stopped') {
                                        if (shareStatus) {
                                            icon = 'pause';
                                        } else {
                                            downloadStatus = true;
                                        }
                                    } else if (entry['status']=='checking') {
                                        if (!shareStatus) {
                                            downloadStatus = true;
                                        }
                                        checkingStatus = true;
                                    } else if (entry['status']=='starting') {
                                        if (!shareStatus) {
                                            downloadStatus = true;
                                        }
                                    } else if (entry['status']=='stopping') {
                                        if (!shareStatus) {
                                            downloadStatus = true;
                                        }
                                    } else if (entry['status']=='queued') {
                                        if (!shareStatus) {
                                            downloadStatus = true;
                                        }
                                    }
                                    let download:any = new DownloadModel(
                                        entry['id'],
                                        entry['name'],
                                        entry['size'],
                                        size,
                                        entry['queue_pos'],
                                        entry['status'],
                                        icon,
                                        entry['rx_bytes'],
                                        remainingTime,
                                        progress,
                                        speed,
                                        checkingStatus,
                                        downloadStatus,
                                        shareStatus
                                    );
                                    downloads.push(download);
                                }
                            }
                            resolve(downloads);
                        } else {
                            resolve(false);
                        }
                    },
                    err => {
                        resolve(false);
                    }
                );
        });

    }

    deleteDownload(id, eraseFiles) {
        return new Promise(resolve => {
            this.commonService.getTokenSession().then(tokenSession => {
                if (tokenSession) {
                    this.deleteDownloadGranted(id, tokenSession, eraseFiles).then(drop => {
                        if (!drop['success']) {
                            this.challenge().then(tokenSession => {
                                if (tokenSession) {
                                    this.deleteDownloadGranted(id, tokenSession, eraseFiles).then(drop => {
                                        resolve(drop);
                                    });
                                } else {
                                    resolve({'success': false});
                                }
                            });
                        } else {
                            resolve(drop);
                        }
                    });
                } else {
                    this.challenge().then(tokenSession => {
                        if (tokenSession) {
                            this.deleteDownloadGranted(id, tokenSession, eraseFiles).then(drop => {
                                resolve(drop);
                            });
                        } else {
                            resolve({'success': false});
                        }
                    });
                }
            });

        });
    }

    deleteDownloadGranted(id, tokenSession, eraseFiles) {
        return new Promise(resolve => {
            let header = new HttpHeaders()
                .set('Content-Type', 'application/x-www-form-urlencoded')
                .set('X-Fbx-App-Auth', tokenSession);
            const reqOpts = {
                headers: header
            };
            const eraseUrlSuffix = eraseFiles ? '/erase' : '';
            this.http.delete(this.routeDownloads + id + eraseUrlSuffix, reqOpts)
                .subscribe(
                    response => {
                        resolve(response);
                    },
                    err => {
                        resolve({'success': false});
                    }
                );
        });
    }

    setStatusDownload(id, parameters) {
        return new Promise(resolve => {
            this.commonService.getTokenSession().then(tokenSession => {
                if (tokenSession) {
                    this.setStatusDownloadGranted(id, parameters, tokenSession).then(status => {
                        if (!status['success']) {
                            this.challenge().then(tokenSession => {
                                if (tokenSession) {
                                    this.setStatusDownloadGranted(id, parameters, tokenSession).then(status => {
                                        resolve(status);
                                    });
                                } else {
                                    resolve({'success': false});
                                }
                            });
                        } else {
                            resolve(status);
                        }
                    });
                } else {
                    this.challenge().then(tokenSession => {
                        if (tokenSession) {
                            this.setStatusDownloadGranted(id, parameters, tokenSession).then(status => {
                                resolve(status);
                            });
                        } else {
                            resolve({'success': false});
                        }
                    });
                }
            });

        });
    }

    setStatusDownloadGranted(id, parameters, tokenSession) {
        return new Promise(resolve => {
            let header = new HttpHeaders()
                .set('Content-Type', 'application/x-www-form-urlencoded')
                .set('X-Fbx-App-Auth', tokenSession);
            const reqOpts = {
                headers: header
            };
            this.http.put(this.routeDownloads + id, parameters, reqOpts)
                .subscribe(
                    response => {
                        resolve(response);
                    },
                    err => {
                        resolve({'success': false});
                    }
                );
        });
    }

    addDownloadByUrl(url, downloadDirectory) {
        return new Promise(resolve => {
            this.commonService.getTokenSession().then(tokenSession => {
                if (tokenSession) {
                    this.addDownloadByUrlGranted(url, downloadDirectory, tokenSession).then(add => {
                        if (!add['success']) {
                            this.challenge().then(tokenSession => {
                                if (tokenSession) {
                                    this.addDownloadByUrlGranted(url, downloadDirectory, tokenSession).then(add => {
                                        resolve(add);
                                    });
                                } else {
                                    resolve({'success': false});
                                }
                            });
                        } else {
                            resolve(add);
                        }
                    });
                } else {
                    this.challenge().then(tokenSession => {
                        if (tokenSession) {
                            this.addDownloadByUrlGranted(url, downloadDirectory, tokenSession).then(add => {
                                resolve(add);
                            });
                        } else {
                            resolve({'success': false});
                        }
                    });
                }
            });

        });
    }

    addDownloadByUrlGranted(url, downloadDirectory, tokenSession) {
        return new Promise(resolve => {
            let header = new HttpHeaders()
                .set('Content-Type', 'application/x-www-form-urlencoded')
                .set('X-Fbx-App-Auth', tokenSession);
            const reqOpts = {
                headers: header
            };
            let payload = new HttpParams()
                .set('download_url', url);

            // download_dir (string) – The download destination directory (optional: will use the configuration download_dir by default)
            if (downloadDirectory != null) {
                const base64DownloadDirectoryParam = btoa(downloadDirectory)
                payload = payload
                    .set('download_dir', base64DownloadDirectoryParam);
            }

            this.http.post(this.routeDownloadAddByUrl, payload, reqOpts)
                .subscribe(
                    response => {
                        resolve(response);
                    },
                    err => {
                        resolve({'success': false});
                    }
                );
        });
    }

}

