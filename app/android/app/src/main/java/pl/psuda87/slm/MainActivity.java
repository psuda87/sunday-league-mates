package pl.psuda87.slm;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SlmPushConfigurationPlugin.class);
        super.onCreate(savedInstanceState);
        // The approved web UI has a mix of Ionic safe-area and CSS env() users.
        // Keep one native inset owner instead of relying on WebView version.
        SlmWindowInsets.install(getWindow());
    }
}
