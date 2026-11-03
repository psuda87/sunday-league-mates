package pl.psuda87.slm;

import android.view.View;
import android.view.Window;
import android.os.Build;
import android.util.DisplayMetrics;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

/** Native safe viewport for every SLM route, including Ionic keyboard forms. */
final class SlmWindowInsets {
    private SlmWindowInsets() {}

    static void install(Window window) {
        WindowCompat.setDecorFitsSystemWindows(window, false);
        View decor = window.getDecorView();
        // Replace Capacitor SystemBars' decor listener: combining two independent
        // owners would apply status/keyboard spacing twice on older WebViews.
        ViewCompat.setOnApplyWindowInsetsListener(decor, (view, insets) -> {
            Insets bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
            );
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
            int height;
            if (Build.VERSION.SDK_INT >= 30) {
                height = window.getWindowManager().getCurrentWindowMetrics().getBounds().height();
            } else {
                DisplayMetrics metrics = new DisplayMetrics();
                window.getWindowManager().getDefaultDisplay().getRealMetrics(metrics);
                height = metrics.heightPixels;
            }
            // Android12/OEM adjustResize may already exclude the keyboard.
            // Only reserve the part that is still inside the actual window.
            int excluded = ime.bottom > 0 && view.getHeight() > 0 ? Math.max(0, height - view.getHeight()) : 0;
            view.setPadding(bars.left, bars.top, bars.right, bottomPadding(bars.bottom, ime.bottom, excluded));
            // These regions have already been excluded from the native viewport.
            // Forward zeros so WebView/Ionic do not also reserve them with env().
            return new WindowInsetsCompat.Builder(insets)
                .setInsets(
                    WindowInsetsCompat.Type.systemBars() |
                    WindowInsetsCompat.Type.displayCutout() |
                    WindowInsetsCompat.Type.ime(),
                    Insets.NONE
                )
                .setInsetsIgnoringVisibility(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout(), Insets.NONE)
                // Older WebViews also inspect the raw DisplayCutout object.
                .setDisplayCutout(null)
                .build();
        });
        ViewCompat.requestApplyInsets(decor);
    }

    static int bottomPadding(int navigation, int keyboard, int alreadyExcluded) {
        return Math.max(0, Math.max(navigation, keyboard) - alreadyExcluded);
    }
}
