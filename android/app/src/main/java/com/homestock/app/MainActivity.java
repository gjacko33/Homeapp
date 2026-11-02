package com.homestock.app;

import android.app.Activity;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Shows the bundled Home Stock screen (assets/index.html) and sends its requests
 * to the user's Apps Script web app. Network calls run natively, so there are no
 * browser CORS limits and Apps Script's redirect is followed correctly.
 */
public class MainActivity extends Activity {

    private static final String PREFS = "home_stock";
    private static final String START_URL = "file:///android_asset/index.html";

    private WebView web;
    private final ExecutorService io = Executors.newCachedThreadPool();
    private final Handler main = new Handler(Looper.getMainLooper());

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // Stay on the bundled page; ignore any other navigation.
                return !request.getUrl().toString().startsWith("file:///android_asset/");
            }
        });
        web.addJavascriptInterface(new Bridge(), "AndroidBridge");
        setContentView(web);
        web.loadUrl(START_URL);
    }

    @Override
    protected void onDestroy() {
        io.shutdownNow();
        web.destroy();
        super.onDestroy();
    }

    private SharedPreferences prefs() {
        return getSharedPreferences(PREFS, MODE_PRIVATE);
    }

    /** Methods callable from JavaScript as window.AndroidBridge.*. */
    private class Bridge {

        @JavascriptInterface
        public String getSettings() {
            JSONObject o = new JSONObject();
            try {
                o.put("url", prefs().getString("url", ""));
                o.put("key", prefs().getString("key", ""));
            } catch (JSONException ignored) {
            }
            return o.toString();
        }

        @JavascriptInterface
        public void saveSettings(String url, String key) {
            prefs().edit().putString("url", url).putString("key", key).apply();
        }

        /** Async POST; the result is delivered to window.__nativeResolve(id, ok, text). */
        @JavascriptInterface
        public void request(final String id, final String url, final String body) {
            io.execute(() -> {
                boolean ok;
                String text;
                try {
                    text = post(url, body);
                    ok = true;
                } catch (Exception e) {
                    text = e.getMessage() != null ? e.getMessage() : e.toString();
                    ok = false;
                }
                final String js = "window.__nativeResolve(" + JSONObject.quote(id) + ","
                        + ok + "," + JSONObject.quote(text) + ")";
                main.post(() -> web.evaluateJavascript(js, null));
            });
        }
    }

    private static HttpURLConnection open(URL url) throws IOException {
        HttpURLConnection c = (HttpURLConnection) url.openConnection();
        c.setInstanceFollowRedirects(false);
        c.setConnectTimeout(15000);
        c.setReadTimeout(30000);
        return c;
    }

    /**
     * Apps Script answers a POST with a 302 to a googleusercontent.com URL that
     * must be fetched with GET, so redirects are followed by hand.
     */
    static String post(String url, String body) throws IOException {
        URL current = new URL(url);
        HttpURLConnection c = open(current);
        c.setRequestMethod("POST");
        c.setDoOutput(true);
        c.setRequestProperty("Content-Type", "text/plain;charset=utf-8");
        try (OutputStream os = c.getOutputStream()) {
            os.write(body.getBytes(StandardCharsets.UTF_8));
        }
        int code = c.getResponseCode();
        for (int hops = 0; code >= 300 && code < 400 && hops < 5; hops++) {
            String location = c.getHeaderField("Location");
            c.disconnect();
            if (location == null) throw new IOException("Redirect without location");
            current = new URL(current, location);
            c = open(current);
            code = c.getResponseCode();
        }
        InputStream in = code >= 400 ? c.getErrorStream() : c.getInputStream();
        String text = read(in);
        c.disconnect();
        if (code >= 400) throw new IOException("Server error (HTTP " + code + ")");
        return text;
    }

    private static String read(InputStream in) throws IOException {
        if (in == null) return "";
        try (InputStream is = in; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buf = new byte[8192];
            int n;
            while ((n = is.read(buf)) != -1) out.write(buf, 0, n);
            return out.toString(StandardCharsets.UTF_8.name());
        }
    }
}
