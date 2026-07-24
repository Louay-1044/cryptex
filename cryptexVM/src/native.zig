const std = @import("std");
const builtin = @import("builtin");
const value = @import("value.zig");
const VM = @import("vm.zig").VM;
const user = @import("user.zig");

pub const NativeFunction = struct {
    name: []const u8,
    paramCount: u8,
    function: *const fn (*VM) bool,
};

pub const NATIVE_FUNCTIONS = [_]NativeFunction{
    .{
        .name="math.random",
        .paramCount = 2,
        .function = &nativeMathRandom,
    },

    .{
        .name="time.wait",
        .paramCount = 1,
        .function = &nativeTimeWait,
    },

    .{
        .name="trade.get_price",
        .paramCount = 2,
        .function = &nativeTradeGetPrice,
    },

    .{
        .name="trade.get_highest",
        .paramCount = 2,
        .function = &nativeTradeGetHighest,
    },

    .{
        .name="trade.get_lowest",
        .paramCount = 2,
        .function = &nativeTradeGetLowest,
    },

    .{
        .name="user.get_balance",
        .paramCount = 0,
        .function = &nativeUserBalance,
    },

    .{
        .name="user.amount_owned",
        .paramCount=1,
        .function=&nativeUserAmountOwned,
    },

    .{
        .name="user.buy",
        .paramCount=2,
        .function=&nativeUserBuy,
    },

    .{
        .name="user.sell",
        .paramCount=2,
        .function=&nativeUserSell,
    },
};

pub fn nativeMathRandom(vm: *VM) bool {
    if (vm.*.stackTop < 2) {
        return false;
    }

    const b = vm.*.pop();
    const a = vm.*.pop();

    if (b.number < a.number) {
        return false;
    }

    var prng = std.Random.DefaultPrng.init(@intCast(std.time.nanoTimestamp()));
    _ = prng.random().intRangeAtMost(u32,
        @intFromFloat(a.number),
        @intFromFloat(b.number)
    );

    vm.*.push(.{.number=3.0});
    return true;
}

pub fn nativeTimeWait(vm: *VM) bool {
    if (vm.*.stackTop < 1) {
        return false;
    }

    const a = vm.*.pop();
    const nanoseconds: u64 = @intFromFloat(a.number * 1_000_000_000);
    std.Thread.sleep(nanoseconds);
    return true;
}

pub fn nativeTradeGetPrice(vm: *VM) bool {
    if (vm.*.stackTop < 2) {
        return false;
    }

    const b = vm.*.pop();
    const a = vm.*.pop();
    var price: f128 = 0.0;

    if (builtin.mode == .Debug) {
        std.debug.print("Getting price of {d} {s}\n", .{b.number, a.currency.ticker});
    }

    price = a.currency.getValuePast(b.number) catch return false;

    vm.*.push(.{.number=price});
    return true;
}

pub fn nativeTradeGetHighest(vm: *VM) bool {
    if (vm.*.stackTop < 2) {
        return false;
    }

    const b = vm.*.pop();
    const a = vm.*.pop();

    if (value.greater(a,b) catch return false) {
        vm.*.push(a);
        return true;
    }
    vm.*.push(b);
    return true;
}

pub fn nativeTradeGetLowest(vm: *VM) bool {
    if (vm.*.stackTop < 2) {
        return false;
    }

    const b = vm.*.pop();
    const a = vm.*.pop();

    if (value.lesser(a,b) catch return false) {
        vm.*.push(a);
        return true;
    }
    vm.*.push(b);
    return true;
}

pub fn nativeUserBalance(vm: *VM) bool {
    if (builtin.mode == .Debug) {
        std.debug.print("Attempting to get balance\n", .{});
        vm.*.push(.{.number=1000.0});
        return true;
    }

    const balance: f128 = user.getBalance() catch |err| {
        std.debug.print("Error {}\n", .{err});
        return false;
    };
    vm.*.push(.{.number=balance});
    // std.debug.print("Balance: {d}\n", .{balance});
    return true;
}

pub fn nativeUserAmountOwned(vm: *VM) bool {
    if (vm.*.stackTop < 1) {
        return false;
    }
    const a = vm.*.pop();

    if (builtin.mode == .Debug) {
        std.debug.print("Attempting get amount owned of {s}\n", .{a.currency.ticker});
        vm.*.push(.{.number=0.0});
        return true;
    }

    const amount = user.getHolding(a.currency.ticker) catch |err| {
        std.debug.print("Error {}\n", .{err});
        return false;
    };
    vm.*.push(.{.number=amount});

    return true;
}

pub fn nativeUserBuy(vm: *VM) bool {
    if (vm.*.stackTop < 2) {
        return false;
    }

    const b = vm.*.pop();
    const a = vm.*.pop();

    if (builtin.mode == .Debug) {
        std.debug.print("Buying {d} of {s}\n", .{b.number, a.currency.ticker});
        return true;
    }

    return user.buy(b.number, a.currency.ticker);
}

pub fn nativeUserSell(vm: *VM) bool {
    if (vm.*.stackTop < 2) {
        return false;
    }
    const b = vm.*.pop();
    const a = vm.*.pop();

    if (builtin.mode == .Debug) {
        std.debug.print("Selling {d} of {s}\n", .{b.number, a.currency.ticker});
        return true;
    }

    return user.sell(b.number, a.currency.ticker);
}
