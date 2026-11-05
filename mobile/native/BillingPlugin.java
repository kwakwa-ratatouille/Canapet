package com.canapet.app;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Collections;
import java.util.List;

/** Achat du Pass Soirée par Google Play (version Play seulement). Le serveur vérifie ensuite le jeton d'achat. */
@CapacitorPlugin(name = "Billing")
public class BillingPlugin extends Plugin {
    private BillingClient client;
    private PluginCall pendingBuy;

    private interface Ready {
        void run();
    }

    private void withClient(PluginCall call, Ready then) {
        if (client == null) {
            client = BillingClient.newBuilder(getContext())
                .setListener(this::onPurchases)
                .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                .build();
        }
        if (client.isReady()) {
            then.run();
            return;
        }
        client.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(BillingResult r) {
                if (r.getResponseCode() == BillingClient.BillingResponseCode.OK) then.run();
                else call.reject("indisponible", String.valueOf(r.getResponseCode()));
            }

            @Override
            public void onBillingServiceDisconnected() {}
        });
    }

    private void details(PluginCall call, String id, java.util.function.Consumer<ProductDetails> then) {
        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
            .setProductList(Collections.singletonList(
                QueryProductDetailsParams.Product.newBuilder().setProductId(id).setProductType(BillingClient.ProductType.INAPP).build()))
            .build();
        client.queryProductDetailsAsync(params, (result, list) -> {
            List<ProductDetails> found = list.getProductDetailsList();
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK || found == null || found.isEmpty()) {
                call.reject("produit-introuvable");
                return;
            }
            then.accept(found.get(0));
        });
    }

    /** Prix affiché par Google, dans la monnaie du joueur. */
    @PluginMethod
    public void product(PluginCall call) {
        String id = call.getString("id", "");
        withClient(call, () -> details(call, id, (d) -> {
            JSObject out = new JSObject();
            out.put("price", d.getOneTimePurchaseOfferDetailsList().get(0).getFormattedPrice());
            call.resolve(out);
        }));
    }

    @PluginMethod
    public void buy(PluginCall call) {
        String id = call.getString("id", "");
        withClient(call, () -> details(call, id, (d) -> {
            pendingBuy = call;
            call.setKeepAlive(true);
            getActivity().runOnUiThread(() -> {
                BillingFlowParams flow = BillingFlowParams.newBuilder()
                    .setProductDetailsParamsList(Collections.singletonList(
                        BillingFlowParams.ProductDetailsParams.newBuilder()
                            .setProductDetails(d)
                            .setOfferToken(d.getOneTimePurchaseOfferDetailsList().get(0).getOfferToken())
                            .build()))
                    .build();
                BillingResult r = client.launchBillingFlow(getActivity(), flow);
                if (r.getResponseCode() != BillingClient.BillingResponseCode.OK) finishBuy(null, "erreur-" + r.getResponseCode());
            });
        }));
    }

    private void onPurchases(BillingResult result, List<Purchase> purchases) {
        int code = result.getResponseCode();
        if (code == BillingClient.BillingResponseCode.USER_CANCELED) {
            finishBuy(null, "annule");
            return;
        }
        if (code != BillingClient.BillingResponseCode.OK || purchases == null || purchases.isEmpty()) {
            finishBuy(null, "erreur-" + code);
            return;
        }
        Purchase p = purchases.get(0);
        // Paiement différé (espèces en magasin…) : pas encore acquis
        if (p.getPurchaseState() != Purchase.PurchaseState.PURCHASED) finishBuy(null, "attente");
        else finishBuy(p.getPurchaseToken(), null);
    }

    private void finishBuy(String token, String error) {
        PluginCall call = pendingBuy;
        pendingBuy = null;
        if (call == null) return;
        call.setKeepAlive(false);
        if (error != null) {
            call.reject(error);
            return;
        }
        JSObject out = new JSObject();
        out.put("token", token);
        call.resolve(out);
    }

    /** Achat déjà fait sur ce compte Google Play (nouveau téléphone, réinstallation). */
    @PluginMethod
    public void owned(PluginCall call) {
        String id = call.getString("id", "");
        withClient(call, () -> client.queryPurchasesAsync(
            QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(),
            (result, purchases) -> {
                JSObject out = new JSObject();
                for (Purchase p : purchases) {
                    if (p.getProducts().contains(id) && p.getPurchaseState() == Purchase.PurchaseState.PURCHASED) out.put("token", p.getPurchaseToken());
                }
                call.resolve(out);
            }));
    }
}
