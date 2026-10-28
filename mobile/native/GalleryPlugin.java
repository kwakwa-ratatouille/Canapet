package com.canapet.app;

import android.Manifest;
import android.content.Intent;
import android.provider.Settings;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.ImageDecoder;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.util.Base64;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/** Photo Roulette : pioche des photos (ou vidéos) au hasard dans toute la galerie. */
@CapacitorPlugin(
    name = "Gallery",
    permissions = {
        @Permission(alias = "media", strings = { Manifest.permission.READ_MEDIA_IMAGES, Manifest.permission.READ_MEDIA_VIDEO }),
        @Permission(alias = "legacy", strings = { Manifest.permission.READ_EXTERNAL_STORAGE })
    }
)
public class GalleryPlugin extends Plugin {
    private static final int MAX_SIDE = 960;
    private static final long MAX_VIDEO = 8L * 1024 * 1024;

    private String alias() {
        return Build.VERSION.SDK_INT >= 33 ? "media" : "legacy";
    }

    @PluginMethod
    public void random(PluginCall call) {
        if (getPermissionState(alias()) != PermissionState.GRANTED) {
            requestPermissionForAlias(alias(), call, "afterPermission");
            return;
        }
        pick(call);
    }

    /** Ouvre la page de l'appli dans les réglages (quand l'accès a été refusé pour de bon). */
    @PluginMethod
    public void openSettings(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName()));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    @PermissionCallback
    private void afterPermission(PluginCall call) {
        if (getPermissionState(alias()) == PermissionState.GRANTED) pick(call);
        else call.reject("Autorisation refusée");
    }

    private void pick(PluginCall call) {
        final int count = call.getInt("count", 3);
        final boolean video = Boolean.TRUE.equals(call.getBoolean("video", false));
        getBridge().execute(() -> {
            try {
                ContentResolver cr = getContext().getContentResolver();
                Uri base = video ? MediaStore.Video.Media.EXTERNAL_CONTENT_URI : MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
                List<long[]> all = new ArrayList<>();
                String[] proj = { MediaStore.MediaColumns._ID, MediaStore.MediaColumns.SIZE };
                try (Cursor c = cr.query(base, proj, null, null, null)) {
                    if (c != null) while (c.moveToNext()) all.add(new long[] { c.getLong(0), c.getLong(1) });
                }
                Collections.shuffle(all);
                JSArray items = new JSArray();
                int got = 0;
                for (long[] m : all) {
                    if (got >= count) break;
                    if (video && m[1] > MAX_VIDEO) continue;
                    Uri uri = ContentUris.withAppendedId(base, m[0]);
                    try {
                        JSObject o = new JSObject();
                        if (video) {
                            o.put("data", Base64.encodeToString(readAll(cr, uri), Base64.NO_WRAP));
                            String type = cr.getType(uri);
                            o.put("mime", type != null ? type : "video/mp4");
                        } else {
                            Bitmap b = decode(cr, uri);
                            ByteArrayOutputStream out = new ByteArrayOutputStream();
                            b.compress(Bitmap.CompressFormat.JPEG, 82, out);
                            o.put("data", Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP));
                            o.put("mime", "image/jpeg");
                        }
                        items.put(o);
                        got++;
                    } catch (Exception ignored) {
                        // fichier illisible : on en prend un autre
                    }
                }
                JSObject ret = new JSObject();
                ret.put("items", items);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject(e.getMessage());
            }
        });
    }

    private static byte[] readAll(ContentResolver cr, Uri uri) throws Exception {
        try (InputStream in = cr.openInputStream(uri); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buf = new byte[65536];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            return out.toByteArray();
        }
    }

    /** Image réduite à 960 px de côté, remise à l'endroit. */
    private static Bitmap decode(ContentResolver cr, Uri uri) throws Exception {
        if (Build.VERSION.SDK_INT >= 28) {
            return ImageDecoder.decodeBitmap(ImageDecoder.createSource(cr, uri), (d, info, src) -> {
                int w = info.getSize().getWidth();
                int h = info.getSize().getHeight();
                float k = Math.min(1f, (float) MAX_SIDE / Math.max(w, h));
                d.setTargetSize(Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k)));
                d.setAllocator(ImageDecoder.ALLOCATOR_SOFTWARE);
            });
        }
        BitmapFactory.Options o = new BitmapFactory.Options();
        o.inJustDecodeBounds = true;
        try (InputStream in = cr.openInputStream(uri)) {
            BitmapFactory.decodeStream(in, null, o);
        }
        int s = 1;
        while (Math.max(o.outWidth, o.outHeight) / (s * 2) >= MAX_SIDE) s *= 2;
        BitmapFactory.Options o2 = new BitmapFactory.Options();
        o2.inSampleSize = s;
        try (InputStream in = cr.openInputStream(uri)) {
            return BitmapFactory.decodeStream(in, null, o2);
        }
    }
}
