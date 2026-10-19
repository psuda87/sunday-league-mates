package pl.psuda87.slm;

import android.app.NotificationManager;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SlmPushConfiguration")
public class SlmPushConfigurationPlugin extends Plugin {
    @PluginMethod
    public void status(PluginCall call) {
        int resource = getContext().getResources().getIdentifier("google_app_id", "string", getContext().getPackageName());
        boolean configured = resource != 0 && !getContext().getString(resource).isEmpty();
        boolean allowed = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            NotificationManager manager = (NotificationManager) getContext().getSystemService(android.content.Context.NOTIFICATION_SERVICE);
            allowed = manager != null && manager.areNotificationsEnabled();
        }
        JSObject result = new JSObject();
        result.put("configured", configured);
        result.put("notificationsAllowed", allowed);
        call.resolve(result);
    }
}
