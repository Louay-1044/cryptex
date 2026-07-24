const std = @import("std");

pub const User = struct {
    pub var userId: []const u8 = undefined;
    pub var authToken: []const u8 = undefined;
};

var gpa = std.heap.GeneralPurposeAllocator(.{}){};
var client = std.http.Client{.allocator = gpa.allocator() };

pub fn setup(userId: []const u8, authToken: []const u8) !void {
    const allocator = gpa.allocator();
    User.userId = try allocator.dupe(u8, userId);
    User.authToken = try allocator.dupe(u8, authToken);
}

// EXAMPLE USAGE:
// curl -X GET -H "Authorization: Token key" http://localhost:8000/api/algorithm/balance/
// response {"wallet_balance":1000.0}
pub fn getBalance() !f128 {
    const BalanceResponse = struct {
        wallet_balance: f128,
    };

    var arena = std.heap.ArenaAllocator.init(gpa.allocator());
    defer arena.deinit();
    const allocator = arena.allocator();

    const url = "http://localhost:8000/api/algorithm/balance/";
    const uri = try std.Uri.parse(url);
    const auth_header = try std.fmt.allocPrint(allocator, "Token {s}", .{User.authToken});
    var req = try client.request(.GET, uri, .{
        .headers = .{
            .authorization = .{.override = auth_header},
        },
    });
    defer req.deinit();

    try req.sendBodiless();
    var response = try req.receiveHead(&.{});

    var body_list: std.ArrayList(u8) = .empty;
    defer body_list.deinit(allocator);

    var transfer_buffer: [8192]u8 = undefined;
    const body_reader = response.reader(&transfer_buffer);

    while (true) {
        const size = try body_reader.readSliceShort(&transfer_buffer);
        if (size == 0) break;
        try body_list.appendSlice(allocator, transfer_buffer[0..size]);
    }

    const parsed = try std.json.parseFromSlice(BalanceResponse, allocator, body_list.items, .{});
    defer parsed.deinit();

    return parsed.value.wallet_balance;
}

// EXAMPLE USAGE:
// curl -X GET -H "Authorization: Token key" http://localhost:8000/api/algorithm/holding?ticker=BTC
// response {"ticker":"BTC","amount":2.5}
pub fn getHolding(ticker: []const u8) !f128 {
    const HoldingResponse = struct {
        ticker: []const u8,
        amount: f128,
    };

    var arena = std.heap.ArenaAllocator.init(gpa.allocator());
    defer arena.deinit();
    const allocator = arena.allocator();

    const url = try std.fmt.allocPrint(allocator, "http://localhost:8000/api/algorithm/holding/?ticker={s}", .{ticker});
    const uri = try std.Uri.parse(url);
    const auth_header = try std.fmt.allocPrint(allocator, "Token {s}", .{User.authToken});

    var req = try client.request(.GET, uri, .{
        .headers = .{
            .authorization = .{.override = auth_header},
        },
    });
    defer req.deinit();

    try req.sendBodiless();
    var response = try req.receiveHead(&.{});

    var body_list: std.ArrayList(u8) = .empty;
    defer body_list.deinit(allocator);

    var transfer_buffer: [8192]u8 = undefined;
    const body_reader = response.reader(&transfer_buffer);

    while (true) {
        const size = try body_reader.readSliceShort(&transfer_buffer);
        if (size == 0) break;
        try body_list.appendSlice(allocator, transfer_buffer[0..size]);
    }

    const parsed = try std.json.parseFromSlice(HoldingResponse, allocator, body_list.items, .{});
    defer parsed.deinit();

    return parsed.value.amount;
}

// EXAMPLE USAGE:
// curl -X POST -H "Authorization: Token key"
// -H "Content-Type: application/json"
// -d '{"amount_bought": "4", "currency_bought": "ETH"}' http://localhost:8000/api/algorithm/buy/
// response 200 on success
pub fn buy(amount: f128, ticker: []const u8) bool {
    const multiplier = 1e2;
    const rounded = @round(amount * multiplier) / multiplier;

    var arena = std.heap.ArenaAllocator.init(gpa.allocator());
    defer arena.deinit();
    const allocator = arena.allocator();

    const url = "http://localhost:8000/api/algorithm/buy/";
    const uri = std.Uri.parse(url) catch return false;

    const auth_header = std.fmt.allocPrint(allocator, "Token {s}", .{User.authToken}) catch return false;
    const body = std.fmt.allocPrint(allocator, "{{\"amount_bought\": \"{d}\", \"currency_bought\": \"{s}\"}}", .{rounded, ticker}) catch return false;

    var req = client.request(.POST, uri, .{
        .headers = .{
            .authorization = .{.override = auth_header},
            .content_type = .{.override = "application/json"},
        },
    }) catch return false;
    defer req.deinit();


    _ = req.sendBodyComplete(body) catch return false;
    var response = req.receiveHead(&.{}) catch return false;

    return response.head.status.class() == .success;
}

// EXAMPLE USAGE:
// curl -X POST -H "Authorization: Token key"
// -H "Content-Type: application/json"
// -d '{"amount_sold": "4", "currency_sold": "ETH"}' http://localhost:8000/api/algorithm/sell/
// response 200 on success
pub fn sell(amount: f128, ticker: []const u8) bool {
    const multiplier = 1e2;
    const rounded = @round(amount * multiplier) / multiplier;

    var arena = std.heap.ArenaAllocator.init(gpa.allocator());
    defer arena.deinit();
    const allocator = arena.allocator();

    const url = "http://localhost:8000/api/algorithm/sell/";
    const uri = std.Uri.parse(url) catch return false;

    const auth_header = std.fmt.allocPrint(allocator, "Token {s}", .{User.authToken}) catch return false;
    const body = std.fmt.allocPrint(allocator, "{{\"amount_sold\": \"{d}\", \"currency_sold\": \"{s}\"}}", .{rounded, ticker}) catch return false;

    var req = client.request(.POST, uri, .{
        .headers = .{
            .authorization = .{.override = auth_header},
            .content_type = .{.override = "application/json"},
        },
    }) catch return false;
    defer req.deinit();


    _ = req.sendBodyComplete(body) catch return false;
    var response = req.receiveHead(&.{}) catch return false;

    return response.head.status.class() == .success;
}
