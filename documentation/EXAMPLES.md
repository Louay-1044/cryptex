# Example Programs
Need to add example images at some point.

## Program 1
```
forever {
    buy(C_BTC, get_balance() / get_price_now(C_BTC))
    wait(1)
    sell(C_BTC, amount_owned(C_BTC))
}
```

## Program 2
```
var VAR_DELTA;
fn FUNC_buy_sell() {
    foreach LOCAL_a {
        VAR_delta := random(0, 1);
        if get_price_now(LOCAL_a) > get_price(LOCAL_a, VAR_delta) {
            buy(LOCAL_a, get_balance() / get_price_now(LOCAL_a));
        } else {
            sell(LOCAL_a, amount_owned(LOCAL_a));
        }
    }
}

forever {
    FUNC_buy_sell();
}
```
