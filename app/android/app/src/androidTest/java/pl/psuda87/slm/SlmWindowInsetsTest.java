package pl.psuda87.slm;

import static org.junit.Assert.*;

import android.view.View;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class SlmWindowInsetsTest {
    private static final int BARS = WindowInsetsCompat.Type.systemBars();

    @Test
    public void resizedAndEdgeToEdgeWindowsReserveKeyboardOnce() {
        assertEquals(900, SlmWindowInsets.bottomPadding(48, 900, 0));
        assertEquals(0, SlmWindowInsets.bottomPadding(48, 900, 900));
        assertEquals(200, SlmWindowInsets.bottomPadding(48, 900, 700));
        assertEquals(48, SlmWindowInsets.bottomPadding(48, 20, 0));
        assertEquals(0, SlmWindowInsets.bottomPadding(48, 900, 1000));
    }

    @Test
    public void appliesCutoutNavigationAndKeyboardWithoutAccumulation() {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> {
                View decor = activity.getWindow().getDecorView();
                // Portrait, then IME, then landscape cutout, then IME dismissal.
                check(decor, Insets.of(0, 72, 0, 48), Insets.NONE, 0, 0, 72, 0, 48);
                check(decor, Insets.of(0, 72, 0, 48), Insets.NONE, 900, 0, 72, 0, 900);
                check(decor, Insets.of(0, 0, 48, 0), Insets.of(96, 0, 0, 0), 0, 96, 0, 48, 0);
                check(decor, Insets.of(0, 72, 0, 48), Insets.NONE, 0, 0, 72, 0, 48);
                // Navigation can exceed the IME inset during animation.
                check(decor, Insets.of(0, 72, 0, 48), Insets.NONE, 20, 0, 72, 0, 48);
            });
        }
    }

    @Test
    public void realWebViewStartsBelowStatusBar() throws Exception {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            // Allow the real WebView page-commit/insets callback to run first.
            Thread.sleep(3000);
            scenario.onActivity(activity -> {
                View decor = activity.getWindow().getDecorView();
                WindowInsetsCompat actual = ViewCompat.getRootWindowInsets(decor);
                assertNotNull(actual);
                Insets bars = actual.getInsets(BARS | WindowInsetsCompat.Type.displayCutout());
                assertTrue("Status bar must be visible in this test", bars.top > 0);
                int[] origin = new int[2];
                activity.getBridge().getWebView().getLocationOnScreen(origin);
                assertEquals("One status-bar inset, including after WebView page commit", bars.top, origin[1]);
                assertEquals(bars.top, decor.getPaddingTop());
            });
        }
    }

    private static void check(View decor, Insets bars, Insets cutout, int keyboard,
                              int left, int top, int right, int bottom) {
        WindowInsetsCompat request = new WindowInsetsCompat.Builder()
            .setInsets(BARS, bars)
            .setInsets(WindowInsetsCompat.Type.displayCutout(), cutout)
            .setInsets(WindowInsetsCompat.Type.ime(), Insets.of(0, 0, 0, keyboard))
            .build();
        WindowInsetsCompat forwarded = ViewCompat.dispatchApplyWindowInsets(decor, request);
        assertEquals(left, decor.getPaddingLeft());
        assertEquals(top, decor.getPaddingTop());
        assertEquals(right, decor.getPaddingRight());
        assertEquals(bottom, decor.getPaddingBottom());
        assertEquals(Insets.NONE, forwarded.getInsets(BARS |
            WindowInsetsCompat.Type.displayCutout() | WindowInsetsCompat.Type.ime()));
    }
}
