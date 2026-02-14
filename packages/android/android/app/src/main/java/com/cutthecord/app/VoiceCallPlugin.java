package com.cutthecord.app;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Log;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

@CapacitorPlugin(
    name = "VoiceCallService",
    permissions = {
        @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = "microphone"),
        @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "notifications")
    }
)
public class VoiceCallPlugin extends Plugin {

    private static final String TAG = "VoiceCallPlugin";

    @PluginMethod()
    public void startService(PluginCall call) {
        try {
            // Request microphone permission if not granted (needed for microphone foreground service type)
            if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECORD_AUDIO)
                    != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(
                    getActivity(),
                    new String[]{ Manifest.permission.RECORD_AUDIO },
                    1001
                );
            }

            // Request notification permission on Android 13+ (needed for foreground service notification)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS)
                        != PackageManager.PERMISSION_GRANTED) {
                    ActivityCompat.requestPermissions(
                        getActivity(),
                        new String[]{ Manifest.permission.POST_NOTIFICATIONS },
                        1002
                    );
                }
            }

            Intent serviceIntent = new Intent(getContext(), VoiceCallService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(serviceIntent);
            } else {
                getContext().startService(serviceIntent);
            }
            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "Failed to start foreground service", e);
            // Don't crash — voice still works, just no background keepalive
            call.resolve();
        }
    }

    @PluginMethod()
    public void stopService(PluginCall call) {
        try {
            Intent serviceIntent = new Intent(getContext(), VoiceCallService.class);
            getContext().stopService(serviceIntent);
        } catch (Exception e) {
            Log.e(TAG, "Failed to stop foreground service", e);
        }
        call.resolve();
    }
}
