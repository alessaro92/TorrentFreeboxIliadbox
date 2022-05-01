import { Component } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { NavController, ActionSheetController, AlertController } from 'ionic-angular';
import { FreeboxService } from '../../providers/freebox-service';
import { CommonService } from '../../providers/common-service';
import { ISubscription } from 'rxjs/Subscription';
import { Observable } from 'rxjs/Observable';

@Component({
    selector: 'page-download',
    templateUrl: 'download.html',
    providers: [FreeboxService, CommonService]
})
export class DownloadPage {

    private shareMode:boolean;
    private downloads:any = [];
    private noDownload:boolean;
    private noFullDownload:boolean;
    private noDownloadMessage:string;
    private subscriptionTimer:ISubscription;
    private firstLoad:boolean;

    constructor(public navCtrl: NavController, private freeboxService: FreeboxService,
                private commonService: CommonService, private actionsheetCtrl: ActionSheetController,
                private alertCtrl: AlertController, public translate: TranslateService) {
        this.noDownload = false;
        this.noDownloadMessage = "";
        
        translate.addLangs(['en', 'fr', 'it']);
        translate.setDefaultLang('en');

        const browserLang = translate.getBrowserLang();
        translate.use(browserLang.match(/en|fr|it/) ? browserLang : 'en');
    }

    ionViewDidEnter () {
        this.shareMode = false;
        this.downloads = [];
        this.noDownload = false;
        this.noFullDownload = false;
        this.noDownloadMessage = "";
        this.firstLoad = true;
        this.commonService.getGranted().then(granted => {
            if (granted) {
                this.translate.get('pages.download.pleaseWait').subscribe(
                    pleaseWait => {
                        this.commonService.loadingShow(pleaseWait);
                        this.subscriptionTimer = Observable.interval(2500).subscribe(x => {
                            if (!this.noFullDownload) {
                                this.showDownloads();
                            }
                        });
                    }
                )
            }
        });
    }

    onChangeMode() {
        const pleaseWait = this.translate.instant('pages.download.pleaseWait');
        this.commonService.loadingShow(pleaseWait);
        this.firstLoad = true;
        this.downloads = [];
        if (this.noFullDownload) {
            this.showDownloads();
        }
    }

    ionViewDidLeave () {
        this.subscriptionTimer.unsubscribe ();
    }

    showDownloads() {
        this.freeboxService.getDownloads().then(downloads => {
            if (downloads) {
                const allDownloadModel:any = downloads;
                if (allDownloadModel.length > 0) {
                    this.noFullDownload = false;
                    this.downloads = allDownloadModel.filter((downloadModel) =>
                        downloadModel.shareStatus == this.shareMode
                    );
                } else {
                    this.downloads = [];
                    this.noFullDownload = true;
                }
                if (this.downloads.length > 0) {
                    this.noDownload = false;
                } else {
                    this.noDownloadMessage = this.translate.instant(
                        this.shareMode
                        ? 'pages.download.noSharingInProgress'
                        : 'pages.download.noDownloadInProgress');
                    this.noDownload = true;
                }
            }
            if (this.firstLoad) {
                this.firstLoad = false;
                this.commonService.loadingHide();
            }
        });
    }

    openMenu(download) {
        let statusButton:any;
        if (download.status=='stopped') {
            const playText = this.translate.instant('pages.download.play');
            statusButton = {
                text: playText,
                icon: 'play',
                handler: () => {
                    this.play(download);
                }
            }
        } else {
            const pauseText = this.translate.instant('pages.download.pause');
            statusButton = {
                text: pauseText,
                icon: 'pause',
                handler: () => {
                    this.pause(download);
                }
            }
        }
        const deleteText = this.translate.instant('pages.download.delete');
        const cancelText = this.translate.instant('pages.download.cancel');
        let actionSheet;
        let buttons:any = [
            statusButton,
            {
                text: deleteText,
                role: 'destructive',
                icon: 'trash',
                handler: () => {
                    actionSheet.dismiss();
                    this.openDeleteMenu(download);
                    return false;
                }
            },
            {
                text: cancelText,
                role: 'cancel',
                icon: 'close',
                handler: () => {
                    console.log('cancel');
                }
            }
        ];
        actionSheet = this.actionsheetCtrl.create({
            title: download.title,
            cssClass: 'action-sheets-basic-page',
            buttons: buttons
        });
        actionSheet.present();
    }

    openDeleteMenu(download) {
        const keepFilesText = this.translate.instant('pages.download.keepFiles');
        const eraseFilesText = this.translate.instant('pages.download.eraseFiles');
        const cancelText = this.translate.instant('pages.download.cancel');
        let buttons:any = [
            {
                text: keepFilesText,
                icon: 'hand',
                handler: () => {
                    this.showConfirmDelete(download, false);
                }
            },
            {
                text: eraseFilesText,
                role: 'destructive',
                icon: 'trash',
                handler: () => {
                    this.showConfirmDelete(download, true);
                }
            },
            {
                text: cancelText,
                role: 'cancel',
                icon: 'close',
                handler: () => {
                    console.log('cancel delete');
                }
            }
        ];
        let actionSheet = this.actionsheetCtrl.create({
            title: download.title,
            cssClass: 'action-sheets-basic-page',
            buttons: buttons
        });
        actionSheet.present();
    }

    showConfirmDelete(download, eraseFiles) {
        // todo : Add the keep/erase files info in the confirm message
        const deleteConfirmMsg = this.translate.instant('pages.download.deleteConfirm', { downloadTitle: download.title });
        const deleteTitle = this.translate.instant('pages.download.deleteTitle');
        const yesLabel = this.translate.instant('pages.download.yes');
        const noLabel = this.translate.instant('pages.download.no');
        let confirm = this.alertCtrl.create({
            title: deleteTitle,
            message: deleteConfirmMsg,
            buttons: [
                {
                    text: yesLabel,
                    handler: () => {
                        this.delete(download, eraseFiles);
                    }
                },
                {
                    text: noLabel,
                    handler: () => {
                        //console.log('Non');
                    }
                }
            ]
        });
        confirm.present();
    }

    delete(download, eraseFiles) {
        const pleaseWait = this.translate.instant('pages.download.pleaseWait');
        this.commonService.loadingShow(pleaseWait);
        this.freeboxService.deleteDownload(download.id, eraseFiles).then(deleted => {
            this.firstLoad = true;
            if (!deleted['success']) {
                const deleteError = this.translate.instant('pages.download.deleteError');
                this.commonService.toastShow(deleteError);
            }
        });
    }

    pause(download) {
        const pleaseWait = this.translate.instant('pages.download.pleaseWait');
        this.commonService.loadingShow(pleaseWait);
        let param: any = {
            "status": "stopped"
        };
        this.freeboxService.setStatusDownload(download.id, param).then(pause => {
            this.firstLoad = true;
            if (!pause['success']) {
                const pauseError = this.translate.instant('pages.download.pauseError');
                this.commonService.toastShow(pauseError);
            }
        });
    }

    play(download) {
        const pleaseWait = this.translate.instant('pages.download.pleaseWait');
        this.commonService.loadingShow(pleaseWait);
        let param: any = {
            "status": "downloading"
        };
        this.freeboxService.setStatusDownload(download.id, param).then(play => {
            this.firstLoad = true;
            if (!play['success']) {
                const resumeError = this.translate.instant('pages.download.resumeError');
                this.commonService.toastShow(resumeError);
            }
        });
    }

}
