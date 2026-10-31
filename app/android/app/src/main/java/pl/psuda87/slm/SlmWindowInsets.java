package pl.psuda87.slm;

import android.view.View;
import android.view.Window;
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
            view.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, ime.bottom));
            // These regions have already been excluded from the native viewport.
            // Forward zeros so WebView/Ionic do not also reserve them with env().
            return new WindowInsetsCompat.Builder(insets)
                .setInsets(
                    WindowInsetsCompat.Type.systemBars() |
                    WindowInsetsCompat.Type.displayCutout() |
                    WindowInsetsCompat.Type.ime(),
                    Insets.NONE
                )
                .build();
        });
        ViewCompat.requestApplyInsets(decor);
    }
}
