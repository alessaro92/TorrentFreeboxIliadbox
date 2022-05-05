import { Component } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { NavController } from 'ionic-angular';
import { ISubscription } from 'rxjs/Subscription';
import { FreeboxService } from '../../providers/freebox-service';
import { CommonService } from '../../providers/common-service';
import { TabsPage } from '../tabs/tabs';
import { Observable } from 'rxjs/Rx';

@Component({
    selector: 'page-authentication',
    templateUrl: 'authentication.html',
    providers: [CommonService, FreeboxService]
})
export class AuthenticationPage {

  private authMessage:string;
  private subscriptionTimer:ISubscription;
  private readonly brandModelParam:any;

  constructor(private navCtrl: NavController, public commonService: CommonService,
              public freeboxService: FreeboxService, public translate: TranslateService) {
      this.authMessage = "";
      this.brandModelParam = { brandModel: commonService.isIliadbox() ? 'iliadbox' : 'Freebox' };

      translate.addLangs(['en', 'fr', 'it']);
      translate.setDefaultLang('en');

      const browserLang = translate.getBrowserLang();
      translate.use(browserLang.match(/en|fr|it/) ? browserLang : 'en');
  }

  authentification () {
      this.authMessage = "";
      const requestInProgress = this.translate.instant('pages.config.requestInProgress');;
      this.commonService.loadingShow(requestInProgress);
      this.freeboxService.auth().then(auth => {
          this.commonService.loadingHide();
          if (auth) {
              const pleaseAuthorize = this.translate.instant('pages.config.pleaseAuthorize', this.brandModelParam);
              this.commonService.loadingShow(pleaseAuthorize);
              this.subscriptionTimer = Observable.interval(2500).subscribe(x => {
                  this.checkStatus();
              });
          } else {
              this.authMessage = this.translate.instant('pages.config.authError');
          }
      });
  }

  ionViewDidLeave () {
      this.subscriptionTimer.unsubscribe ();
  }

  checkStatus () {
      this.freeboxService.getStatus().then(status => {
          if (status=='granted') {
              const authorizationSuccessful = this.translate.instant('pages.config.authorizationSuccessful');
              this.commonService.toastShow(authorizationSuccessful);
              this.commonService.loadingHide();
              this.subscriptionTimer.unsubscribe ();
              this.navCtrl.setRoot(TabsPage);
          } else if (status!='pending') {
              const authorizationError = this.translate.instant('pages.config.authorizationError');
              this.subscriptionTimer.unsubscribe ();
              this.commonService.loadingHide();
              this.commonService.toastShow(authorizationError);
          }
      });
  }
}
