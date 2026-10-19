package com.icc.hub;

import android.os.Bundle;
import android.os.Build;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.graphics.Color;
import android.webkit.WebView;
import android.webkit.ValueCallback;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private long lastBackPressTime = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Ensure status bar is themed to ICC dark background with white icons
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            Window window = getWindow();
            window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            window.setStatusBarColor(Color.parseColor("#0e1621"));
            window.setNavigationBarColor(Color.parseColor("#0e1621"));
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                View decor = window.getDecorView();
                int flags = decor.getSystemUiVisibility();
                flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                decor.setSystemUiVisibility(flags);
            }
        }

        // Intercept Android hardware back button and gesture navigation
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (bridge != null && bridge.getWebView() != null) {
                    final WebView webView = bridge.getWebView();
                    webView.post(new Runnable() {
                        @Override
                        public void run() {
                            webView.evaluateJavascript(
                                "(function() {" +
                                "  if (typeof AndroidNavigation !== 'undefined' && AndroidNavigation.handleBackAction) {" +
                                "    return AndroidNavigation.handleBackAction();" +
                                "  } else if (typeof Router !== 'undefined' && Router.goBack && Router.goBack()) {" +
                                "    return true;" +
                                "  } else if (window.location.hash && window.location.hash !== '#dashboard' && window.location.hash !== '#') {" +
                                "    window.location.hash = '#dashboard';" +
                                "    return true;" +
                                "  }" +
                                "  return false;" +
                                "})()",
                                new ValueCallback<String>() {
                                    @Override
                                    public void onReceiveValue(String value) {
                                        // If JS handled it (closed modal or navigated back), value is "true"
                                        // If JS returned false (we are on Home and ready to exit), handle double-press
                                        if ("false".equals(value) || "null".equals(value)) {
                                            long now = System.currentTimeMillis();
                                            if (now - lastBackPressTime < 2000) {
                                                finish();
                                            } else {
                                                lastBackPressTime = now;
                                                webView.post(new Runnable() {
                                                    @Override
                                                    public void run() {
                                                        webView.evaluateJavascript(
                                                            "if (typeof Toast !== 'undefined' && Toast.info) { Toast.info('Press back again to exit app'); }",
                                                            null
                                                        );
                                                    }
                                                });
                                            }
                                        }
                                    }
                                }
                            );
                        }
                    });
                } else {
                    finish();
                }
            }
        });
    }

    @Override
    public void onBackPressed() {
        getOnBackPressedDispatcher().onBackPressed();
    }
}
