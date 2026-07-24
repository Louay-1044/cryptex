const std = @import("std");

pub const Currency = struct {
    const Self = @This();
    var values: ?[][]const u8 = null;
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    var client = std.http.Client{.allocator = gpa.allocator() };

    ticker: []const u8,
    val: usize,

    pub fn init(ticker: []const u8) !Self {
        if (values == null) values = try getPossibleValues();
        var val: usize = 0;
        var found = false;
        for (values.?, 0..) |v, i| {
            if (std.mem.eql(u8, v, ticker)) {
                val = i;
                found = true;
                break;
            }
        }

        if (!found) return error.NotValidCurrency;

        return .{
            .ticker=ticker,
            .val=val,
        };
    }

    // deinits static variables
    pub fn staticDeinit() void {
        client.deinit();
        const alloc = gpa.allocator();
        if (values) |vals| {
            for (vals) |ticker| {
                alloc.free(ticker);
            }
            alloc.free(vals);
        }

        _ = gpa.deinit();
    }

    pub fn increment(self: Self) !Self {
        const index = self.val + 1;
        if (index < values.?.len) {
            return Currency.init(values.?[index]);
        }
        return error.AtEnd;
    }

    pub fn getValue(self: *const Self) !f128 {
        var arena = std.heap.ArenaAllocator.init(gpa.allocator());
        defer arena.deinit();
        const allocator = arena.allocator();

        const symbol = try std.fmt.allocPrint(
            allocator,
            "{s}USDT",
            .{self.ticker},
        );

        const url = try std.fmt.allocPrint(
            allocator,
            "https://api.binance.com/api/v3/ticker/price?symbol={s}",
            .{symbol},
        );

        const uri = try std.Uri.parse(url);

        var req = try client.request(.GET, uri, .{});
        defer req.deinit();

        try req.sendBodiless();
        const response = try req.receiveHead(&.{});

        var body_list: std.ArrayList(u8) = .empty;
        defer body_list.deinit(allocator);

        var transfer_buffer: [8192]u8 = undefined;
        const body_reader = req.reader.bodyReader(&transfer_buffer, .none, response.head.content_length);

        var done = false;
        while (!done) {
            const size = try body_reader.readSliceShort(&transfer_buffer);
            if (size > 0) {
                try body_list.appendSlice(allocator, transfer_buffer[0..size]);
            }
            if (size < transfer_buffer.len) {
                done = true;
            }
        }

        var parsed = try std.json.parseFromSlice(std.json.Value, allocator, body_list.items, .{});
        defer parsed.deinit();

        const price_value = parsed.value.object.get("price") orelse return error.MissingPrice;
        const price_str = switch (price_value) {
            .string => |s| s,
            .number_string => |s| s,
            else => return error.InvalidPriceType,
        };

        return try std.fmt.parseFloat(f128, price_str);
    }


    pub fn getValuePast(self: *const Self, seconds: f128) !f128 {
        var arena = std.heap.ArenaAllocator.init(gpa.allocator());
        defer arena.deinit();
        const allocator = arena.allocator();

        const symbol = try std.fmt.allocPrint(
            allocator,
            "{s}USDT",
            .{self.ticker},
        );

        const now_ms = std.time.milliTimestamp();
        const past_ms = now_ms - @as(i64, @intFromFloat(seconds * 1000));

        const url = try std.fmt.allocPrint(
            allocator,
            "https://api.binance.com/api/v3/klines?symbol={s}&interval=1m&startTime={d}&limit=1",
            .{ symbol, past_ms },
        );

        const uri = try std.Uri.parse(url);

        var req = try client.request(.GET, uri, .{});
        defer req.deinit();

        try req.sendBodiless();
        const response = try req.receiveHead(&.{});

        var body_list: std.ArrayList(u8) = .empty;
        defer body_list.deinit(allocator);

        var transfer_buffer: [8192]u8 = undefined;
        const body_reader = req.reader.bodyReader(&transfer_buffer, .none, response.head.content_length);

        var done = false;
        while (!done) {
            const size = try body_reader.readSliceShort(&transfer_buffer);
            if (size > 0) {
                try body_list.appendSlice(allocator, transfer_buffer[0..size]);
            }
            if (size < transfer_buffer.len) {
                done = true;
            }
        }

        var parsed = try std.json.parseFromSlice(std.json.Value, allocator, body_list.items, .{});
        defer parsed.deinit();

        if (parsed.value.array.items.len < 1) return try self.getValue();
        const candle = parsed.value.array.items[0].array.items[4];
        const price_str = switch (candle) {
            .string => |s| s,
            .number_string => |s| s,
            else => return error.InvalidPriceType,
        };

        return try std.fmt.parseFloat(f128, price_str);
    }

    fn getPossibleValues() ![][]const u8 {
        const alloc = gpa.allocator();
        var arena = std.heap.ArenaAllocator.init(alloc);
        defer arena.deinit();
        const arena_alloc = arena.allocator();

        const url = "http://localhost:8000/api/currency/list/";
        const uri = try std.Uri.parse(url);

        var req = try client.request(.GET, uri, .{});
        defer req.deinit();

        try req.sendBodiless();
        const response = try req.receiveHead(&.{});

        var body_list: std.ArrayList(u8) = .empty;
        defer body_list.deinit(arena_alloc);

        var transfer_buffer: [8192]u8 = undefined;
        const body_reader = req.reader.bodyReader(&transfer_buffer, .none, response.head.content_length);

        var done = false;
        while (!done) {
            const size = try body_reader.readSliceShort(&transfer_buffer);
            if (size > 0) {
                try body_list.appendSlice(arena_alloc, transfer_buffer[0..size]);
            }
            if (size < transfer_buffer.len) {
                done = true;
            }
        }

        var parsed = try std.json.parseFromSlice(std.json.Value, arena_alloc, body_list.items, .{});
        defer parsed.deinit();

        const currencies_array = parsed.value.array.items;
        var tickers: std.ArrayList([]const u8) = .empty;

        for (currencies_array) |currency| {
            const ticker_value = currency.object.get("ticker") orelse return error.MissingTicker;
            const ticker_str = switch (ticker_value) {
                .string => |s| s,
                else => return error.InvalidTickerType,
            };
            const ticker_copy = try alloc.dupe(u8, ticker_str);
            try tickers.append(alloc, ticker_copy);
        }

        return tickers.toOwnedSlice(alloc);
    }

    pub fn getFirst() !Self {
        if (values == null) values = try getPossibleValues();

        return try Self.init(values.?[0]);
    }
};


