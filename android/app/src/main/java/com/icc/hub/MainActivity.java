package com.icc.hub;

import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onBackPressed() {
        if (this.bridge != null && this.bridge.getWebView() != null) {
            final WebView webView = this.bridge.getWebView();
            webView.post(new Runnable() {
                @Override
                public void run() {
                    webView.evaluateJavascript(
                        "(function() {" +
                        "  if (typeof AndroidNavigation !== 'undefined') {" +
                        "    AndroidNavigation.handleBackAction();" +
                        "  } else if (window.history.length > 1) {" +
                        "    window.history.back();" +
                        "  } else {" +
                        "    window.location.hash = '#dashboard';" +
                        "  }" +
                        "})();", null
                    );
                }
            });
        } else {
            super.onBackPressed();
        }
    }
}
