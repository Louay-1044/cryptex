const std = @import("std");
const builtin = @import("builtin");
const chunk = @import("chunk.zig");
const currency = @import("currency.zig");
const vm = @import("vm.zig");

// MAIN IS THE ENTRYPOINT TO PROGRAM
// THE PROGRAM TAKES IN A FILE TO RUN
pub fn main() !void {
    if (std.os.argv.len != 2) {
        std.debug.print("Incorrect usage\n", .{});
        return;
    }

    defer _ = currency.Currency.staticDeinit();
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    if (builtin.mode != .Debug) try setup(allocator);

    const path = std.mem.span(std.os.argv[1]);
    try runFile(path, allocator);
}

// TO RUN A FILE CREATE A VIRTUAL MACHINE
// AND CALL INTERPRET
fn runFile(path: []const u8, allocator : std.mem.Allocator) !void {
    var file = std.fs.cwd().openFile(path, .{}) catch {
        std.debug.print("File not found!\n", .{});
        std.process.exit(1);
    };
    defer file.close();

    const stat = try file.stat();
    const source = try file.readToEndAlloc(allocator, stat.size);
    defer allocator.free(source);

    var v = vm.VM.init(allocator);
    defer v.deinit();
    defer vm.VM.staticDeinit();

    const result = v.interpret(source);
    switch (result) {
        .COMPILE_ERR => std.process.exit(75),
        .RUNTIME_ERR => std.process.exit(65),
        else => return,
    }
}

// SETUP USER WITH ENV VAR
// CHECK IF env(USER_ID) and env(AUTH_TOKEN) are set
fn setup(allocator: std.mem.Allocator) !void {
    const user = @import("user.zig");
    var env_map = try std.process.getEnvMap(allocator);
    defer env_map.deinit();

    const user_id = env_map.get("USER_ID") orelse {
        std.process.exit(1);
        unreachable;
    };

    const auth_token = env_map.get("AUTH_TOKEN") orelse {
        std.process.exit(1);
        unreachable;
    };

    try user.setup(user_id, auth_token);
    // std.debug.print("User Id: {s}\n", .{user_id});
    // std.debug.print("Auth_token: {s}\n", .{user.User.authToken});
}
