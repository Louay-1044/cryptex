const std = @import("std");
const builtin = @import("builtin");
const chunk = @import("chunk.zig");
const value = @import("value.zig");
const compiler = @import("compiler.zig");
const debug = @import("debug.zig");

pub const Result = enum {
    OK,
    COMPILE_ERR,
    RUNTIME_ERR,
};


// A VIRTUAL MACHINE TAKES IN A SOURCE STRING
// COMPILES TO A CHUNK AND THEN RUNS THE CHUNK
// IT IS STACK BASED MEANING VALUES ARE STORED ON STACK
pub const VM = struct {
    const Self = @This();
    const Handler = *const (fn (self: *VM, ip: usize) usize);
    const errorFn: (fn (vm: *VM) usize) = VM.raiseErr;
    const stackSize = 256;
    const CallFrame = struct {
        returnAddr: usize,
        localCount: u8,
        localStart: usize,
    };
    var table: std.StringHashMap(value.Value) = undefined;
    var err: bool = false;
    var stop: bool = false;
    var threadCount: usize = 0;

    c: chunk.Chunk,
    stack: [stackSize]value.Value,
    stackTop: usize = 0,
    returnStack: std.ArrayList(usize),
    callStack: std.ArrayList(CallFrame),
    local: std.ArrayList(value.Value),
    allocator : std.mem.Allocator,
    isAsync: bool = false,

    // THE INIT METHOD CREATES A NEW CHUNK AND A STACK
    // DEINIT NEEDS TO BE CALLED TO AVOID MEMORY LEAKS
    pub fn init(allocator: std.mem.Allocator) Self {
        var stack: [stackSize]value.Value = undefined;
        @memset(&stack, undefined);
        VM.table = .init(allocator);
        return .{
            .c = chunk.Chunk.init(allocator),
            .stack = stack,
            .returnStack = .empty,
            .callStack = .empty,
            .local = .empty,
            .allocator = allocator,
        };
    }

    pub fn deinit(self: *Self) void {
        self.returnStack.deinit(self.allocator);
        self.callStack.deinit(self.allocator);
        self.local.deinit(self.allocator);
        self.c.deinit();
    }

    pub fn staticDeinit() void {
        VM.table.deinit();

    }

    // CREATE A DEEP COPY
    fn clone(self: VM, allocator: std.mem.Allocator) !VM {
        var cloned = self;

        cloned.returnStack = try self.returnStack.clone(allocator);
        cloned.callStack = try self.callStack.clone(allocator);
        cloned.local = try self.local.clone(allocator);
        cloned.c = try self.c.clone(allocator);

        return cloned;
    }

    // ADD A VALUE TO STACK
    pub fn push(self: *Self, val : value.Value) void {
        self.stack[self.stackTop] = val;
        self.stackTop += 1;
    }

    // REMOVE TOP VALUE FROM STACK
    pub fn pop(self: *Self) value.Value {
        self.stackTop -= 1;
        return self.stack[self.stackTop];
    }

    // PEEK AT TOP VALUE FROM STACK
    pub fn peek(self: *Self) value.Value {
        return self.stack[self.stackTop - 1];
    }

    // THE ENTRYPOINT METHOD
    // THE INTERPET METHOD TAKES IN SOURCE CODE AND COMPILES
    // TO CHUNK AND RUNS USING SELF.RUN() A RESULT
    pub fn interpret(self : *Self, source : []const u8) Result {
        var comp = compiler.Compiler.init(source, &self.c);
        defer comp.deinit();
        if (!comp.compile()) {
            return .COMPILE_ERR;
        }

        return self.run();
    }

    // HERE IS WHERE CODE RUNS
    // ip IS AN INSTRUCTION POINTER
    // EACH INSTRUCTION HAS AN ASSOCIATED HANDLER METHOD
    // THAT RETURNS THE NEW IP
    // IT IS THE RESPONSIBILTY OF
    // HANDLER METHODS TO MAKE SURE NEW IP POINTS TO AN INSTRUCTION
    // AND NOT AN ADDRESS
    fn run(self : *Self) Result {
        if (builtin.mode == .Debug) {
            std.debug.print("== Virtual Machine ==\n", .{});
        }

        const handlers = comptime VM.getHandlers();
        var ip : usize = 0;
        self.callStack.append(self.allocator, .{
            .returnAddr = 0,
            .localCount = 0,
            .localStart = 0,
        }) catch return Result.RUNTIME_ERR;
        while (!VM.err and !VM.stop and ip < self.c.code.items.len) {
            const instruction = self.c.code.items[ip];
            const tmp = handlers[instruction](self, ip);
            if (builtin.mode == .Debug) {
                _ = debug.dissembleInstruction(self.c,ip);
                debug.printStack(self.stack[0..self.stackTop]);
            }
            ip = tmp;
        }
        if (VM.err) {
            if (builtin.mode == .Debug) {
                std.debug.print("Error occured during runtime!\n", .{});
            }
            return Result.RUNTIME_ERR;
        }
        while (!VM.stop and VM.threadCount > 0) {
            std.Thread.sleep(1000);
        }
        return Result.OK;
    }

    // SHOULD BE RUN IN A SEPERATE THREAD
    fn async_run(input: VM, start: usize) void {
        var vm = input.clone(input.allocator) catch {
            VM.err = true;
            VM.threadCount -= 1;
            return;
        };
        defer vm.deinit();
        var ip = start;

        vm.isAsync = true;
        const handlers = comptime VM.getHandlers();
        while (ip < vm.c.code.items.len) {
            const instruction = vm.c.code.items[ip];
            ip = handlers[instruction](&vm, ip);
        }
        VM.threadCount -= 1;
    }

    // GETHANDLERS RETURNS AN ARRAY OF HANDLER METHODS TO BY RUN
    // MAPPING INSTRUCTION DIRECTLY TO FUNCTION
    fn getHandlers() [getOpcodeCount()]Handler {
        comptime var handlers: [getOpcodeCount()]Handler = undefined;
        inline for (@typeInfo(chunk.Opcode).@"enum".fields, 0..) |field, i| {
            handlers[i] = switch (@field(chunk.Opcode, field.name)) {
                .OP_CONSTANT => VM.handleConstant,
                .OP_POP => VM.handlePop,
                .OP_DEFINE_VAR => VM.handleDefineVar,
                .OP_GET_VAR => VM.handleGetVar,
                .OP_SET_VAR => VM.handleSetVar,
                .OP_EQUALS => VM.handleEquals,
                .OP_GREATER => VM.handleGreater,
                .OP_LESS => VM.handleLesser,
                .OP_ADD => VM.handleAdd,
                .OP_SUBTRACT => VM.handleSubtract,
                .OP_MULTIPLY => VM.handleMultiply,
                .OP_DIVIDE => VM.handleDivide,
                .OP_NOT => VM.handleNot,
                .OP_NEGATE => VM.handleNegate,
                .OP_JUMP_IF_FALSE => VM.handleJumpIf,
                .OP_JUMP => VM.handleJump,
                .OP_INCREMENT => VM.handleIncrement,
                .OP_DEFINE_LOCAL => VM.handleDefineLocal,
                .OP_GET_LOCAL => VM.handleGetLocal,
                .OP_SET_LOCAL => VM.handleSetLocal,
                .OP_CALL => VM.handleCall,
                .OP_ASYNC_CALL => VM.handleAsyncCall,
                .OP_RETURN => VM.handleReturn,
                .OP_CALL_NATIVE => VM.handleNativeCall,
                .OP_STOP => VM.handleStop,
                // else => @compileError("Unhandled opcode: " ++ field.name),
            };
        }
        return handlers;
    }

    fn getOpcodeCount() usize {
        return @typeInfo(chunk.Opcode).@"enum".fields.len;
    }

    fn readShort(self: *Self, ip: usize) usize {
        var jump: usize = @intCast(@as(usize, self.c.code.items[ip + 1]) << 8);
        jump |= @intCast(self.c.code.items[ip + 2]);
        return jump;
    }

    fn raiseErr(self: *Self) usize{
        VM.err = true;
        return self.c.code.items.len;
    }

    // INSTRUCTIONS
    // EACH OPCODE SHOULD HAVE A METHOD HERE

    fn handleConstant(self: *Self, ip: usize) usize {
        const location = self.c.code.items[ip+1];
        const constant = self.c.constants[location];
        self.push(constant);
        return ip + 2;
    }

    fn handlePop(self: *Self, ip: usize) usize {
        if (self.stackTop != 0) _ = self.pop();
        return ip + 1;
    }

    fn handleDefineVar(self: *Self, ip: usize) usize {
        const location = self.c.code.items[ip+1];
        const key = self.c.constants[location].key;
        VM.table.put(key, self.pop()) catch {
            return self.errorFn();
        };
        return ip + 2;
    }

    fn handleGetVar(self: *Self, ip: usize) usize {
        const location = self.c.code.items[ip+1];
        const key = self.c.constants[location].key;
        const val = VM.table.get(key);
        if (val == null) {
            return self.errorFn();
        }
        self.push(val.?);
        return ip + 2;
    }

    fn handleSetVar(self: *Self, ip: usize) usize {
        const location = self.c.code.items[ip+1];
        const key = self.c.constants[location].key;
        const currVal = VM.table.get(key);
        if (currVal == null) {
            return self.errorFn();
        }
        if (!value.sameType(currVal.?, self.peek())) {
            return self.errorFn();
        }
        VM.table.put(key, self.pop()) catch {
            return self.errorFn();
        };
        return ip + 2;
    }

    fn handleStop(self : *Self, _: usize) usize {
        VM.stop = true;
        return self.c.code.items.len;
    }

    fn handleNegate(self: *Self, ip: usize) usize {
        const val = value.getValue(self.pop()) catch {
            return self.errorFn();
        };

        self.push(.{.number=-val});
        return ip + 1;
    }

    fn handleNot(self: *Self, ip: usize) usize {
        const val = value.getBoolean(self.pop()) catch {
            return self.errorFn();
        };
        self.push(.{.boolean=!val});
        return ip + 1;
    }

    fn handleJumpIf(self: *Self, ip: usize) usize {
        const jump = self.readShort(ip);
        const val = self.peek();
        if (value.trueEquals(.{.boolean=false}, val)) {
            return jump;
        }
        return ip + 3;

    }

    fn handleJump(self: *Self, ip: usize) usize {
        return self.readShort(ip);
    }

    fn handleIncrement(self: *Self, ip: usize) usize {
        var a = self.pop();
        a = value.increment(a) catch {
            self.push(.{ .boolean = false });
            return ip + 1;
        };
        self.push(a);
        self.push(.{.boolean=true});
        return ip + 1;
    }

    fn handleDefineLocal(self: *Self, ip: usize) usize {
        const count = self.c.code.items[ip+1];
        for (0..count) |_| {
            const val = self.pop();
            self.local.append(self.allocator, val) catch {
                return self.raiseErr();
            };
        }
        return ip + 2;
    }

    fn handleGetLocal(self: *Self, ip: usize) usize {
        const index = self.c.code.items[ip+1];
        const currentFrame = self.callStack.items[self.callStack.items.len  - 1];
        const localIndex = currentFrame.localStart + index;

        self.push(self.local.items[localIndex]);
        return ip + 2;
    }

    fn handleSetLocal(self: *Self,ip: usize) usize {
        const index = self.c.code.items[ip+1];
        const val = self.pop();
        const currentFrame = self.callStack.items[self.callStack.items.len - 1];
        const localIndex = currentFrame.localStart + index;

        self.local.items[localIndex] = val;

        return ip + 2;
    }

    fn handleCall(self: *Self, ip: usize) usize {
        const addr = self.readShort(ip);
        const localStart = self.local.items.len;
        self.callStack.append(self.allocator, .{
            .returnAddr = ip + 3,
            .localCount = 0,
            .localStart = localStart,
        }) catch return self.errorFn();

        return addr;
    }

    fn handleAsyncCall(self: *Self, ip: usize) usize {
        const addr = self.readShort(ip);
        const localStart = self.local.items.len;
        var copy = self.*;

        copy.callStack.append(self.allocator, .{
            .returnAddr = ip + 3,
            .localCount = 0,
            .localStart = localStart,
        }) catch return self.errorFn();

        VM.threadCount += 1;
        _ = std.Thread.spawn(.{}, VM.async_run, .{copy, addr})
            catch return self.errorFn();
        return ip + 3;
    }

    fn handleReturn(self: *Self, _: usize) usize {
        if (self.isAsync) return self.c.code.items.len;

        if (self.callStack.items.len == 0) {
            return self.errorFn();
        }

        const frame = self.callStack.pop();
        while (self.local.items.len > frame.?.localStart) {
            _=self.local.pop();
        }

        return frame.?.returnAddr;
    }

    fn handleNativeCall(self: *Self, ip: usize) usize {
        const native = @import("native.zig");
        const index = self.readShort(ip);

        if (index > native.NATIVE_FUNCTIONS.len) {
            return self.raiseErr();
        }

        const nativeFunc = native.NATIVE_FUNCTIONS[index];

        if (!nativeFunc.function(self)) {
            return self.raiseErr();
        }

        return ip + 3;
    }


    const BinaryOp = enum {
        ADD,
        SUBTRACT,
        MULTIPLY,
        DIVIDE,
    };

    // BINARY OPERATIONS USE THIS METHOD FOR COMMON BEHAVIOUR
    // GETTING VALUES OF AN ON STACK.
    // BINARY OPERATIONS NEED TWO VALUES ON STACK
    inline fn performBinaryOp(self: *Self, op: BinaryOp) !void{
        const b = try value.getValue(self.pop());
        const a = try value.getValue(self.pop());

        switch (op) {
            // ARITHMETIC OPERATIONS ADDS NUMBER TO STACK
            .ADD => self.push(.{.number=a+b}),
            .SUBTRACT => self.push(.{.number=a-b}),
            .MULTIPLY => self.push(.{.number=a*b}),
            .DIVIDE => {
                if (b == 0.0) return error.DivideByZero;
                self.push(.{.number=a/b});
            },
        }
    }

    const CompOp = enum {
        EQUALS,
        GREATER,
        LESSER,
    };

    inline fn performCompOp(self: *Self, op: CompOp) !void {
        const b = self.pop();
        const a = self.pop();

        switch (op) {
            // BOOLEAN OPERATIONS ADD BOOL TO STACK
            .EQUALS => {
                const val = try value.equals(a,b);
                self.push(.{.boolean=val});
            },
            .GREATER => {
                const val = try value.greater(a,b);
                self.push(.{.boolean=val});
            },
            .LESSER => {
                const val = try value.lesser(a,b);
                self.push(.{.boolean=val});
            },
        }
    }

    fn handleAdd(self: *Self, ip: usize) usize {
        self.performBinaryOp(.ADD) catch {
            return self.errorFn();
        };
        return ip + 1;
    }

    fn handleSubtract(self: *Self, ip: usize) usize {
        self.performBinaryOp(.SUBTRACT) catch {
            return self.errorFn();
        };
        return ip + 1;
    }

    fn handleMultiply(self: *Self, ip: usize) usize {
        self.performBinaryOp(.MULTIPLY) catch {
            return self.errorFn();
        };
        return ip + 1;
    }

    fn handleDivide(self: *Self, ip: usize) usize {
        self.performBinaryOp(.DIVIDE) catch {
            return self.errorFn();
        };
        return ip + 1;
    }

    fn handleEquals(self: *Self, ip: usize) usize {
        self.performCompOp(.EQUALS) catch {
            return self.errorFn();
        };
        return ip + 1;
    }

    fn handleGreater(self: *Self, ip: usize) usize {
        self.performCompOp(.GREATER) catch {
            return self.errorFn();
        };
        return ip + 1;
    }

    fn handleLesser(self: *Self, ip: usize) usize {
        self.performCompOp(.LESSER) catch {
            return self.errorFn();
        };
        return ip + 1;
    }

};
