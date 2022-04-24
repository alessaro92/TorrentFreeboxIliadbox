import { Component } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { NavController } from 'ionic-angular';
import { ISubscription } from 'rxjs/Subscription';
import { FreeboxService } from '../../providers/freebox-service';
import { CommonService } from '../../providers/common-service';
import { TabsPage } from '../tabs/tabs';
import { Observable } from 'rxjs/Rx';

@Component({
    selector: 'page-config',
    templateUrl: 'config.html',
    providers: [CommonService, FreeboxService]
})
export class ConfigPage {

  private authMessage:string;
  private subscriptionTimer:ISubscription;

  constructor(private navCtrl: NavController, public commonService: CommonService,
              public freeboxService: FreeboxService, public translate: TranslateService) {
      this.authMessage = "";

      translate.addLangs(['en', 'fr', 'it']);
      translate.setDefaultLang('en');

      const browserLang = translate.getBrowserLang();
      translate.use(browserLang.match(/en|fr|it/) ? browserLang : 'en');
  }

  authentification () {
      this.authMessage = "";
      this.commonService.loadingShow("Demande en cours...");
      this.freeboxService.auth().then(auth => {
          this.commonService.loadingHide();
          if (auth) {
              this.commonService.loadingShow("Veuillez autoriser l'application depuis la Freebox");
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
              this.commonService.toastShow("Autorisation effectuée.");
              this.commonService.loadingHide();
              this.subscriptionTimer.unsubscribe ();
              this.navCtrl.setRoot(TabsPage);
          } else if (status!='pending') {
              this.subscriptionTimer.unsubscribe ();
              this.commonService.loadingHide();
              this.commonService.toastShow("Erreur d'autorisation.");
          }
      });
  }
}
