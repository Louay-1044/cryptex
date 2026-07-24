const std = @import("std");
const value = @import("value.zig");

pub const Opcode = enum(u8) {
    OP_CONSTANT, // NEXT BYTE IS LOCATION IN MEMORY PUSH IT TO STACK
    // OP_TRUE, // PUSH TRUE TO STACK
    // OP_FALSE, // PUSH FALSE TO STACK
    OP_POP, // STACK POP
    OP_DEFINE_VAR, // NEXT BYTE IS LOCATION IN MEMORY OF AN INDENTIFIER
    OP_GET_VAR, // NEXT BYTE IS LOCATION OF AN INDENTIFER GET VALUE OF INDEITIFER AND PUSH IT
    OP_SET_VAR, // NEXT BYTE IS LOCATION AN INDENIFTIER POP STACK AND SET IT
    OP_EQUALS, // POP 2 VALUES AND CHECK FOR EQUALITY
    OP_GREATER, // POP 2 VALUES AND IF a>b
    OP_LESS, // POP 2 VALUES AND IF a<b
    OP_ADD, // POP PREVIOUS TWO VALUES AND ADD THEIR ADDITION TO STCK
    OP_SUBTRACT, // SAME AS ADD BUT FOR SUBTRACT
    OP_MULTIPLY, // SAME AS ADD BUT FOR MULTIPLY
    OP_DIVIDE, // SAME AS ADD BUT FOR DIVIDE
    OP_NOT, // POP VALUE AND PUSH NOT OF VALUE TRUE -> FALSE
    OP_NEGATE, // POP VALUE AND PUSH 0 - VALUE
    OP_JUMP_IF_FALSE, // POP VALUE IF FALSE JUMP
    OP_JUMP, // JUMP LOCATION IS IN NEXT 2 BYTES
    OP_INCREMENT, // POP VALUE INCREASE BY 1, PUSH VAL THEN PUSH IF SUCCESSFUL
    OP_DEFINE_LOCAL, // NEXT BYTE IS VARIABLE INDEX
    OP_GET_LOCAL, // NEXT BYTE IS VARIABLE INDEX
    OP_SET_LOCAL, // NEXT BYTE IS VARIABLE INDEX
    OP_CALL, // NEXT 2 BYTES ARE ADDR OF FUNC CODE
    OP_ASYNC_CALL, // CALL FUNCTION AS ASYNC
    OP_RETURN, // POP RETURN ADDRESS
    OP_CALL_NATIVE, // CALL INDEX
    OP_STOP, // EXIT PROGRAM
};

// A CHUNK IS A COLLECTION OF BYTES AND DATA
// BYTES ARE EITHER INSTRUCTIONS OR LOCATIONS
// OF CONSTANTS IN MEMORY.
// DATA IS STORED IN CONSTANTS.
pub const Chunk = struct {
    const Self = @This();
    const ArrayList = std.ArrayList;

    code: ArrayList(u8),
    constants: [255]value.Value, // ArrayList(value.Value),
    nextPos: usize = 0,
    allocator: std.mem.Allocator,

    // INIT A BLANK CHUNK
    // CHUNKS SHOULD BE DELETED WITH DEINIT
    pub fn init(allocator: std.mem.Allocator) Chunk {
        return .{
            .code = .empty,
            .constants = undefined,
            .allocator = allocator,
        };
    }

    pub fn deinit(self: *Self) void {
        self.code.deinit(self.allocator);
        // self.constants.deinit(self.allocator);
    }

    pub fn clone(self: Self, allocator: std.mem.Allocator) !Self {
        var cloned = self;
        cloned.code = try self.code.clone(allocator);

        return cloned;
    }

    // APPEND BYTE TO CHUNK IF SPACE PERMITS
    // MAY RETURN ERROR
    pub fn writeChunk(self: *Self, byte: u8) !void {
        try self.code.append(self.allocator, byte);
    }

    // ADD A VALUE TO MEMORY
    // MAY RETURN ERROR
    pub fn writeConstant(self: *Self, val: value.Value) !u8{
        if (self.nextPos > 255) return error.OutOfMemory;
        for (self.constants[0..self.nextPos], 0..self.nextPos) |item, i| {
            if (value.trueEquals(item, val)) return @truncate(i);
        }
        self.constants[self.nextPos] = val;
        self.nextPos += 1;
        return @truncate(self.nextPos - 1);
    }

    // CHECK IF A VALUE HAS A VALUE
    pub fn hasConstant(self: *Self, val: value.Value) bool{
        for (self.constants[0..self.nextPos]) |item| {
            if (value.trueEquals(item, val))
                return true;
        }
        return false;
    }
};
