package com.luis.home;

import android.accounts.Account;
import android.accounts.AccountManager;
import android.app.Activity;
import android.content.*;
import android.webkit.JavascriptInterface;
import com.google.android.gms.auth.api.identity.*;
import com.google.android.gms.common.api.Scope;
import com.google.android.gms.tasks.Tasks;
import org.json.JSONObject;
import java.util.Arrays;
import java.util.concurrent.*;
import java.util.function.BiConsumer;

/** Google credentials stay in Play services; no token enters JavaScript or HOME Sync. */
final class GoogleBridge {
    static final int ACCOUNT_REQUEST=71,AUTH_REQUEST=72;
    private final Activity activity;
    private final GoogleSync store;
    private final ExecutorService executor=Executors.newSingleThreadExecutor();
    private final BiConsumer<String,JSONObject> callback;
    private volatile boolean authorizing;
    private String chosenAccount="";
    GoogleBridge(Activity activity,BiConsumer<String,JSONObject> callback) {this.activity=activity;this.callback=callback;store=new GoogleSync(activity);}
    static AuthorizationRequest request(Context c) {
        AuthorizationRequest.Builder b=AuthorizationRequest.builder().setRequestedScopes(Arrays.asList(
            new Scope("https://www.googleapis.com/auth/tasks"),new Scope("https://www.googleapis.com/auth/calendar.readonly")));
        String account=c.getSharedPreferences("vbrain_google",0).getString("account","");
        if(!account.isEmpty())b.setAccount(new Account(account,"com.google"));
        return b.build();
    }
    @JavascriptInterface public boolean isConnected() {return store.connected();}
    @JavascriptInterface public String status() {try{return store.snapshot().toString();}catch(Exception e){return "{}";}}
    @JavascriptInterface public void connect() {
        activity.runOnUiThread(()->{if(authorizing)return;if(store.connected()){authorize(true);return;}activity.startActivityForResult(AccountManager.newChooseAccountIntent(null,null,new String[]{"com.google"},null,null,null,null),ACCOUNT_REQUEST);});
    }
    boolean onResult(int requestCode,int resultCode,Intent data) {
        if(requestCode==ACCOUNT_REQUEST){
            if(resultCode!=Activity.RESULT_OK||data==null){error("Google connection cancelled");return true;}
            chosenAccount=data.getStringExtra(AccountManager.KEY_ACCOUNT_NAME);
            if(chosenAccount==null||chosenAccount.isEmpty()){error("Choose a Google account");return true;}
            activity.getSharedPreferences("vbrain_google",0).edit().putString("account",chosenAccount).commit();authorize(true);return true;
        }
        if(requestCode==AUTH_REQUEST){authorizing=false;
            if(resultCode!=Activity.RESULT_OK||data==null){error("Google permission was not granted");return true;}
            try{authorized(Identity.getAuthorizationClient(activity).getAuthorizationResultFromIntent(data));}catch(Exception e){error("Google authorization failed. Register package com.luis.home and this APK's SHA-1 in Google Cloud.");}return true;
        }return false;
    }
    @JavascriptInterface public void sync() {if(store.connected())activity.runOnUiThread(()->authorize(false));}
    private void authorize(boolean interactive) {
        if(authorizing||GoogleSync.BUSY.get())return;authorizing=true;
        Identity.getAuthorizationClient(activity).authorize(request(activity)).addOnSuccessListener(result->{
            authorizing=false;
            if(result.hasResolution()) {
                if(!interactive){error("Reconnect Google to renew permission");return;}
                try{authorizing=true;activity.startIntentSenderForResult(result.getPendingIntent().getIntentSender(),AUTH_REQUEST,null,0,0,0);}catch(Exception e){authorizing=false;error("Could not open Google permission screen");}
            }else authorized(result);
        }).addOnFailureListener(e->{authorizing=false;error("Google authorization failed. Enable the Tasks and Calendar APIs and register com.luis.home with this APK's SHA-1 in Google Cloud.");});
    }
    private void authorized(AuthorizationResult result) {
        String token=result.getAccessToken();
        if(token==null||token.isEmpty()){error("Google did not grant the requested access");return;}
        store.connected(true);callback.accept("onGoogleConnected",new JSONObject());
        if(!GoogleSync.BUSY.compareAndSet(false,true))return;
        executor.execute(()->{
            try{store.sync(token);callback.accept("onGoogleSnapshot",store.snapshot());callback.accept("onGoogleCalendarChanged",new JSONObject());}
            catch(Exception e){try{callback.accept("onGoogleSnapshot",store.snapshot());}catch(Exception ignored){}if(e instanceof GoogleSync.ApiError&&((GoogleSync.ApiError)e).code==401)Identity.getAuthorizationClient(activity).clearToken(ClearTokenRequest.builder().setToken(token).build());error(e.getMessage());}
            finally{GoogleSync.BUSY.set(false);}
        });
    }
    @JavascriptInterface public boolean enqueue(String operation) {
        try{if(!store.connected())return false;boolean saved=store.enqueue(operation);sync();return saved;}
        catch(Exception e){error(e.getMessage());return false;}
    }
    @JavascriptInterface public void selectList(String id) {executor.execute(()->{try{store.selectList(id);callback.accept("onGoogleSnapshot",store.snapshot());}catch(Exception e){error(e.getMessage());}});}
    private void error(String message){try{callback.accept("onGoogleSyncError",new JSONObject().put("message",message==null?"Saved on phone; Google sync will retry":message));}catch(Exception ignored){}}
    void close(){executor.shutdown();}
    static void background(Context context) {
        GoogleSync store=new GoogleSync(context);if(!store.connected()||!GoogleSync.BUSY.compareAndSet(false,true))return;
        try{AuthorizationResult result=Tasks.await(Identity.getAuthorizationClient(context).authorize(request(context)),20,TimeUnit.SECONDS);
            if(!result.hasResolution()&&result.getAccessToken()!=null)store.sync(result.getAccessToken());
        }catch(Exception ignored){/* Durable queue remains intact. A foreground resume reports the failure. */}
        finally{GoogleSync.BUSY.set(false);}
    }
}
