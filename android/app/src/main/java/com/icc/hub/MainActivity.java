package com.icc.hub;

import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(android.os.Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
            android.view.Window window = getWindow();
            window.addFlags(android.view.WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            window.setStatusBarColor(android.graphics.Color.parseColor("#0e1621"));
            window.setNavigationBarColor(android.graphics.Color.parseColor("#0e1621"));
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                android.view.View decor = window.getDecorView();
                int flags = decor.getSystemUiVisibility();
                flags &= ~android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                decor.setSystemUiVisibility(flags);
            }
        }
    }

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
