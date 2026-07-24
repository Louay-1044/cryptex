const std = @import("std");
const scanner = @import("scanner.zig");
const cry = @import("currency.zig");

// VALUE IS A UNTION OF TYPES
// SUCH AS NUMBERS, CURRENCIES AND BOOLEANS
// ALL NUMBERS ARE 128 BIT FLOATS
// CURRENCIES STORE THEIR TICKER
// BOOLEANS ARE BOOLEANS
pub const Value = union(enum) {
    number: f128,
    currency: cry.Currency,
    boolean: bool,
    key: []const u8,
};

// TURN VALUE INTO A NUMBER
// IF VALUE IS A CURRENCY IT SHOULD RETURN VALUE OF 1 UNIT OF CURRENCY
// CURRENTLY CURRENCY RETURNS 1 AS SERVER IS NOT SETUP
pub fn getValue(self: Value) !f128 {
    switch (self) {
        .number => return self.number,
        .currency => return self.currency.getValue(),
        else => return error.NaN,
    }
    unreachable;
}

// TURN VALUE INTO A BOOLEAN
pub fn getBoolean(self: Value) !bool {
    switch (self) {
        .boolean => return self.boolean,
        else => return error.NaB,
    }
    unreachable;
}

// INCREASE VALUE BY 1
pub fn increment(self: Value) !Value {
    switch (self) {
        .number => return .{.number=self.number + 1},
        .currency => {
            const c = try cry.Currency.increment(self.currency);
            return .{.currency = c};
        },
        else => return error.NotItertable
    }
}

// CHECK IF TWO VALUES ARE OF SAME TYPE
pub fn sameType(a: Value, b: Value) bool {
    return @intFromEnum(a) == @intFromEnum(b);
}

// CHECK IF VALUES ARE EQUAL
pub fn equals(a: Value, b: Value) !bool {
    switch (a) {
        .number,
        .currency => {
            const valA = try getValue(a);
            const valB = try getValue(b);
            return valA == valB;
        },
        .boolean => {
            const val = try getBoolean(b);
            return a.boolean == val;
        },
        .key => return error.nil,
    }
    unreachable;
}

// CHECK IF VALUES ARE THE SAME
pub fn trueEquals(a: Value, b: Value) bool {
    switch (a) {
        .number => {
            switch (b) {
                .number => return a.number == b.number,
                else => return false,
            }
        },
        .currency => {
            switch (b) {
                .currency => return std.mem.eql(u8, a.currency.ticker, b.currency.ticker),
                else => return false,
            }
        },
        .boolean => {
            switch (b) {
                .boolean => return a.boolean == b.boolean,
                else => return false,
            }
        },
        .key => {
            switch (b) {
                .key => return std.mem.eql(u8, a.key, b.key),
                else => return false,
            }
        }
    }
    unreachable;
}

// CHECK IF a>b
pub fn greater(a: Value, b: Value) !bool {
    switch (a) {
        .number,
        .currency => {
            const valA = try getValue(a);
            const valB = try getValue(b);
            return valA > valB;
        },
        .boolean => return error.NaN,
        .key => return error.nil,
    }
    unreachable;
}

// CHECK IF a<b
pub fn lesser(a: Value, b: Value) !bool {
    switch (a) {
        .number,
        .currency => {
            const valA = try getValue(a);
            const valB = try getValue(b);
            return valA < valB;
        },
        else => return error.NaN,
    }
    unreachable;

}

// CREATE A VALUE FROM A TOKEN
// ACCEPTED TOKEN TYPES ARE NUMBER, CURRENCY, BOOLEAN
pub fn makeValue(token: scanner.Token) !Value {
    switch (token.type) {
        .TOKEN_NUMBER => {
            const number = try std.fmt.parseFloat(f128, token.content);
            return .{ .number=number };
        },
        .TOKEN_CURRENCY => {
            const currency = token.content[1..token.content.len-1];
            return .{.currency= try cry.Currency.init(currency)};
        },
        .TOKEN_IDENTIFIER => {
            return .{.key=token.content[0..token.content.len]};
        },
        else => return error.UnkownVal,
    }
}

