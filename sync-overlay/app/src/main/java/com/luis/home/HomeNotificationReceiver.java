package com.luis.home;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

public class HomeNotificationReceiver extends BroadcastReceiver {
    private static final String CHANNEL_ID = "home_adaptive";

    @Override
    public void onReceive(Context context, Intent intent) {
        String id = intent == null ? "home" : intent.getStringExtra("id");
        String title = intent == null ? "HOME" : intent.getStringExtra("title");
        String body = intent == null ? "" : intent.getStringExtra("body");
        show(context, id, title, body);
    }

    static void show(Context context, String id, String title, String body) {
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "HOME reminders",
                    NotificationManager.IMPORTANCE_DEFAULT);
            channel.setDescription("Adaptive reminders from HOME");
            manager.createNotificationChannel(channel);
        }

        Intent open = new Intent(context, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent content = PendingIntent.getActivity(
                context,
                0,
                open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        int icon = context.getApplicationInfo().icon;
        if (icon == 0) icon = android.R.drawable.ic_dialog_info;
        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(context, CHANNEL_ID)
                : new Notification.Builder(context);
        builder.setSmallIcon(icon)
                .setContentTitle(title == null || title.isEmpty() ? "HOME" : title)
                .setContentText(body == null ? "" : body)
                .setStyle(new Notification.BigTextStyle().bigText(body == null ? "" : body))
                .setAutoCancel(true)
                .setContentIntent(content)
                .setWhen(System.currentTimeMillis());
        manager.notify(Math.abs((id == null ? "home" : id).hashCode()), builder.build());
    }
}
