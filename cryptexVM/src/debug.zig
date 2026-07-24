const std = @import("std");
const chunk = @import("chunk.zig");
const value = @import("value.zig");

// DEBUG METHODS
// THESES METHODS SHOULD ONLY BE USED WHEN COMPILING WITH DEBUG MODE

// PRINT OUT A ARRAY OF VALUES
pub fn printStack(stack: []value.Value) void{
    std.debug.print("Stack Trace: [", .{});
    for (stack) |val| {
        printValue(val);
        std.debug.print(", ", .{});
    }
    std.debug.print("]\n", .{});
}

// TURN CHUNKS INTO A READABLE FORMAT
// LOOPS THROUGH ALL INSTRUCTIONS
pub fn dissembleChunk(c : chunk.Chunk, name: []const u8) void {
    std.debug.print("== {s} ==\n", .{name});

    var offset : usize = 0;
    while (offset < c.code.items.len) {
        offset = dissembleInstruction(c, offset);
    }
    std.debug.print("\n\n", .{});
}

// DISSEMBLE A GIVEN INSTRUCTION
// INSTRUCTIONS TEND TO HAVE A METHOD TO DECONSTRUCT SEE BELOW
pub fn dissembleInstruction(c : chunk.Chunk, offset: usize) usize {
    std.debug.print("{d:0>4} ", .{offset});

    const instruction : chunk.Opcode = @enumFromInt(c.code.items[offset]);
    switch (instruction) {
        .OP_CONSTANT => return constantInstruction("OP_CONSTANT", c, offset),
        .OP_POP => return simpleInstruction("OP_POP", offset),
        .OP_DEFINE_VAR => return constantInstruction("OP_DEFINE_VAR", c, offset),
        .OP_GET_VAR => return constantInstruction("OP_GET_VAR", c, offset),
        .OP_SET_VAR => return constantInstruction("OP_SET_VAR", c, offset),
        .OP_EQUALS => return simpleInstruction("OP_EQUALS", offset),
        .OP_GREATER => return simpleInstruction("OP_GREATER", offset),
        .OP_LESS => return simpleInstruction("OP_LESS", offset),
        .OP_ADD => return simpleInstruction("OP_ADD", offset),
        .OP_SUBTRACT => return simpleInstruction("OP_SUBTRACT", offset),
        .OP_MULTIPLY => return simpleInstruction("OP_MULTIPLY", offset),
        .OP_DIVIDE => return simpleInstruction("OP_DIVIDE", offset),
        .OP_NEGATE => return simpleInstruction("OP_NEGATE", offset),
        .OP_NOT => return simpleInstruction("OP_NOT", offset),
        .OP_JUMP_IF_FALSE => return jumpInstruction("OP_JUMP_IF_FALSE", c, offset),
        .OP_JUMP => return jumpInstruction("OP_JUMP", c, offset),
        .OP_INCREMENT => return simpleInstruction("OP_INCREMENT", offset),
        .OP_DEFINE_LOCAL => return localInstruction("OP_DEFINE_LOCAL", c, offset),
        .OP_GET_LOCAL => return localInstruction("OP_GET_LOCAL", c, offset),
        .OP_SET_LOCAL => return localInstruction("OP_SET_LOCAL", c, offset),
        .OP_CALL => return jumpInstruction("OP_CALL", c, offset),
        .OP_ASYNC_CALL => return jumpInstruction("OP_ASYNC_CALL", c, offset),
        .OP_RETURN => return simpleInstruction("OP_RETURN", offset),
        .OP_CALL_NATIVE => return jumpInstruction("OP_CALL_NATIVE", c, offset),
        .OP_STOP => return simpleInstruction("OP_STOP", offset),
    }
}

// AN INSTRUCTION THAT IS ONE BYTE LONG
fn simpleInstruction(name : []const u8, offset : usize) usize {
    std.debug.print("{s}\n", .{name});
    return offset + 1;
}

// DECONSTRUCT OP_CONSTANT
// OP_CONSTANT IS TWO BYTES INSTRUCTION + ADDRESS
fn constantInstruction(name: []const u8, c: chunk.Chunk, offset: usize) usize {
    const loc = c.code.items[offset + 1];
    std.debug.print("{s} {d:4} '", .{ name, loc});
    printValue(c.constants[loc]);
    std.debug.print("'\n", .{});
    return offset + 2;
}

fn localInstruction(name: []const u8, c: chunk.Chunk, offset: usize) usize {
    const loc = c.code.items[offset + 1];
    std.debug.print("{s} {d:4} '", .{name, loc});
    std.debug.print("'\n", .{});
    return offset + 2;
}

// DECONSTRUCT JUMP INSTRUCTIONS
fn jumpInstruction(name: []const u8, c: chunk.Chunk, offset: usize) usize {
    var jump: u16 = @intCast(@as(u16, c.code.items[offset + 1]) << 8);
    jump |= @intCast(c.code.items[offset + 2]);
    std.debug.print("{s} {d:4} \n", .{name, jump});
    return offset + 3;
}

// PRINT A VALUE
fn printValue(val: value.Value) void {
    switch (val) {
        .number => std.debug.print("{d}", .{val.number}),
        .currency => std.debug.print("{s}", .{val.currency.ticker}),
        .boolean => std.debug.print("{}", .{val.boolean}),
        .key => std.debug.print("${s}", .{val.key}),
    }
}
