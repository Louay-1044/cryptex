const std = @import("std");
const builtin = @import("builtin");
const scanner = @import("scanner.zig");
const chunk = @import("chunk.zig");
const value = @import("value.zig");
const debug = @import("debug.zig");
const cry = @import("currency.zig");

// THE PRECENDENCE OF AN EXPRESSION
// THINK BIDMAS
const Precendence = enum(usize) {
    PREC_NONE = 1,
    PREC_ASSINGMENT,
    PREC_OR,
    PREC_AND,
    PREC_EQUALITY,
    PREC_COMPARISON,
    PREC_TERM,
    PREC_FACTOR,
    PREC_UNARY,
    PREC_CALL,
    PREC_PRIMARY,
};

// EACH TOKEN HAS SOME ASSOCIATED FUNCTIONS AND PRECENDENCE
// A TABLE IS USED TO STORE THIS INFO
// PREFIX FUNCS HAPPEN BEFORE INFIX FUNCS HAPPEN AFTER
const ParseFunc = *const fn (*Compiler, bool) void;
const ParseRule = struct {
    prefixFn: ?ParseFunc,
    infixFn: ?ParseFunc,
    precedence: Precendence,
};
const RULES = [_]ParseRule{
    .{ .prefixFn = Compiler.grouping, .infixFn = null, .precedence = .PREC_NONE },  //TOKEN_LEFT_PAREN,
    .{ .prefixFn = null, .infixFn = null, .precedence = .PREC_NONE },  //TOKEN_RIGHT_PAREN,
    .{ .prefixFn = null, .infixFn = null, .precedence = .PREC_NONE },  //TOKEN_LEFT_BRACE,
    .{ .prefixFn = null, .infixFn = null, .precedence = .PREC_NONE },  //TOKEN_RIGHT_BRACE,
    .{ .prefixFn = null, .infixFn = Compiler.binary, .precedence = .PREC_FACTOR },  //TOKEN_MULTIPLY,
    .{ .prefixFn = null, .infixFn = null, .precedence = .PREC_NONE },  //TOKEN_MOD,
    .{ .prefixFn = null, .infixFn = null, .precedence = .PREC_NONE },  //TOKEN_COMMA,
    .{ .prefixFn = null, .infixFn = null, .precedence = .PREC_NONE },  //TOKEN_DOT,
    .{ .prefixFn = null, .infixFn = null, .precedence = .PREC_NONE },  //TOKEN_SEMI_COLON,
    .{ .prefixFn = null, .infixFn = Compiler.binary, .precedence = .PREC_EQUALITY},  //TOKEN_BANG_EQUAL,
    .{ .prefixFn = null, .infixFn = Compiler.binary, .precedence = .PREC_EQUALITY},  //TOKEN_EQUALS,
    .{ .prefixFn = null, .infixFn = null, .precedence = .PREC_NONE },  //TOKEN_COLON_EQUAL,
    .{ .prefixFn = null, .infixFn = Compiler.binary, .precedence=.PREC_TERM }, //TOKEN_ADD
    .{ .prefixFn = null, .infixFn = null, .precedence = .PREC_NONE },  //TOKEN_ADD_EQUAL,
    .{ .prefixFn = Compiler.unary, .infixFn = Compiler.binary, .precedence = .PREC_TERM },  //TOKEN_SUBTRACT,
    .{ .prefixFn = null, .infixFn = null, .precedence = .PREC_NONE },  //TOKEN_SUBTRACT_EQUAL,
    .{ .prefixFn = null, .infixFn = Compiler.binary, .precedence = .PREC_COMPARISON},  //TOKEN_GREATER,
    .{ .prefixFn = null, .infixFn = Compiler.binary, .precedence = .PREC_COMPARISON},  //TOKEN_GREATER_EQUAL,
    .{ .prefixFn = null, .infixFn = Compiler.binary, .precedence = .PREC_COMPARISON},  //TOKEN_LESS,
    .{ .prefixFn = null, .infixFn = Compiler.binary, .precedence = .PREC_COMPARISON},  //TOKEN_LESS_EQUAL,
    .{ .prefixFn = null, .infixFn = Compiler.binary, .precedence = .PREC_FACTOR },  //TOKEN_DIVIDE,
    .{ .prefixFn = null, .infixFn = null, .precedence = .PREC_NONE },  //TOKEN_DIV,
    .{ .prefixFn = Compiler.variable, .infixFn = null, .precedence = .PREC_NONE },  //TOKEN_IDENTIFIER,
    .{ .prefixFn = null, .infixFn = null, .precedence = .PREC_NONE },  //TOKEN_BOOLEAN,
    .{ .prefixFn = Compiler.currency, .infixFn = null, .precedence = .PREC_NONE },  //TOKEN_CURRENCY,
    .{ .prefixFn = Compiler.number, .infixFn = null, .precedence = .PREC_NONE },  //TOKEN_NUMBER,
    .{ .prefixFn = null, .infixFn = Compiler.@"and", .precedence = .PREC_AND },  //TOKEN_AND,
    .{ .prefixFn = null, .infixFn = Compiler.@"or", .precedence = .PREC_OR },  //TOKEN_OR,
    .{ .prefixFn = Compiler.unary, .infixFn = null, .precedence = .PREC_NONE },  //TOKEN_NOT,
    .{ .prefixFn = null, .infixFn = null, .precedence = .PREC_NONE },  //TOKEN_VAR,
    .{ .prefixFn = null, .infixFn = null, .precedence = .PREC_NONE },  //TOKEN_FUNC,
    .{ .prefixFn = Compiler.stop, .infixFn = null, .precedence = .PREC_PRIMARY },  //TOKEN_STOP,
    .{ .prefixFn = null, .infixFn = null, .precedence = .PREC_NONE },  //TOKEN_REPEAT,
    .{ .prefixFn = null, .infixFn = null, .precedence = .PREC_NONE },  //TOKEN_FOREVER,
    .{ .prefixFn = null, .infixFn = null, .precedence = .PREC_NONE },  //TOKEN_WHILE,
    .{ .prefixFn = null, .infixFn = null, .precedence = .PREC_NONE },  //TOKEN_FOREACH,
    .{ .prefixFn = null, .infixFn = null, .precedence = .PREC_NONE },  //TOKEN_IF,
    .{ .prefixFn = null, .infixFn = null, .precedence = .PREC_NONE },  //TOKEN_ELSE,
    .{ .prefixFn = null, .infixFn = null, .precedence = .PREC_NONE },  //TOKEN_NUMBER_WORD,
    .{ .prefixFn = null, .infixFn = null, .precedence = .PREC_NONE },  //TOKEN_CURRENCY_WORD
    .{ .prefixFn = null, .infixFn = null, .precedence = .PREC_NONE },  //TOKEN_ASYNC
    .{ .prefixFn = Compiler.@"await", .infixFn = null, .precedence = .PREC_CALL },  //TOKEN_AWAIT
    .{ .prefixFn = null, .infixFn = null, .precedence = .PREC_NONE },  //TOKEN_ERR,
    .{ .prefixFn = null, .infixFn = null, .precedence = .PREC_NONE },  //TOKEN_EOF
};

fn getRule(typ: scanner.TokenType) ParseRule {
    return RULES[@intFromEnum(typ)];
}

// THE COMPILER EXPLORES TOKEN RECURSIVELY
// A WRITES INSTRUCTIONS AND CONSTANTS TO THE CHUNK
pub const Compiler = struct {
    const Self = @This();
    const LocalVar = struct {
        index: u8,
    };
    const Scope = struct {
        variables: std.StringHashMap(LocalVar),
        isFunction: bool,
    };
    const Function = struct {
        addr: usize,
        isAsync: bool,
    };

    c: *chunk.Chunk,
    functions: std.StringHashMap(Function),
    nativeFunctions: std.StringHashMap(u8),
    scopes: std.ArrayList(Scope),
    scnr: scanner.Scanner,
    curr: scanner.Token,
    prev: scanner.Token,
    allocator: std.mem.Allocator,

    // AS C IS A POINTER DO NOT DEINIT
    // SCNR HAS NO DEINIT METHOD
    pub fn init(source: []const u8, c: *chunk.Chunk) Self {
        var compiler: Self = .{
            .c = c,
            .functions = .init(c.*.allocator),
            .nativeFunctions = .init(c.*.allocator),
            .scopes = .empty,
            .scnr = scanner.Scanner.init(source),
            .prev=undefined,
            .curr=undefined,
            .allocator=c.*.allocator,
        };

        compiler.registerNativeFunctions();

        return compiler;
    }

    // DEINIT
    pub fn deinit(self: *Self) void {
        self.functions.deinit();
        self.scopes.deinit(self.allocator);
        self.nativeFunctions.deinit();
    }

    fn registerNativeFunctions(self: *Self) void {
        const native = @import("native.zig");

        for (native.NATIVE_FUNCTIONS, 0..) |nativeFunc, index| {
            self.nativeFunctions.put(nativeFunc.name, @intCast(index)) catch {
                self.raiseError("Error Registering native functions");
            };
        }
    }

    // ENTRYPOINT FOR RECUSSION
    // LAST TOKEN SHOULD EOF OTHERWISE FILE IS CORRUPTED
    // WE THEN ADD
    pub fn compile(self: *Self) bool {
        self.advance();
        while (!self.match(.TOKEN_EOF)) {
            self.declaration();
        }
        self.consume(.TOKEN_EOF);
        //self.emitByte(@intFromEnum(chunk.Opcode.));

        if (builtin.mode == .Debug) {
            debug.dissembleChunk(self.c.*, "Compiled Program");
            //std.process.exit(0);
        }
        return true;
    }

    // ADVANCE MOVES FOWARD ONE TOKEN
    fn advance(self: *Self) void {
        self.prev = self.curr;
        self.curr = self.scnr.scanToken();
        if (builtin.mode == .Debug) {
            std.debug.print("'{s}'\n", .{@tagName(self.curr.type)});
        }

        // IF THERE IS AN ERR TOKEN RAISE ERROR
        if (self.curr.type == .TOKEN_ERR) {
            self.raiseError("Found error token");
        }
    }

    // USE TOKEN IN CURRENT MEMORY AND MOVE FOWARD
    fn consume(self: *Self, expected: scanner.TokenType) void {
        if (self.curr.type == expected) {
            self.advance();
            return;
        }

        self.raiseError("Error on Consumption");
    }

    fn match(self: *Self, typ: scanner.TokenType) bool {
        if (!(self.curr.type == typ)) return false;
        self.advance();
        return true;
    }

    fn check(self: *Self, typ: scanner.TokenType) bool {
        return (self.curr.type == typ);
    }

    // EXIT
    fn raiseError(_: *Self, message: []const u8) void {
        if (builtin.mode == .Debug) {
            std.debug.print("Error: {s}\n", .{message});
        }
        std.process.exit(75);
    }

    fn declaration(self: *Self) void {
        if (self.match(.TOKEN_VAR)) {
            self.varDeclaration();
        } else if (self.match(.TOKEN_FUNC)) {
            self.funcDeclaration(false);
        } else if (self.match(.TOKEN_ASYNC)) {
            self.consume(.TOKEN_FUNC);
            self.funcDeclaration(true);
        } else {
            self.statement();
        }
    }

    fn varDeclaration(self: *Self) void {
        self.consume(.TOKEN_IDENTIFIER);
        const val = value.makeValue(self.prev) catch {
            self.raiseError("Unable To Make indentifier");
            return;
        };

        if (self.match(.TOKEN_NUMBER_WORD)) {
            self.emitConstant(.{.number=0.0});
        } else if (self.match(.TOKEN_CURRENCY_WORD)) {
            const curr = cry.Currency.init("BTC") catch {
                self.raiseError("Error setting up value");
                unreachable;
            };
            self.emitConstant(.{.currency=curr});
        } else {
            self.raiseError("NO TYPE GIVEN");
        }

        const add = self.c.*.writeConstant(val) catch {
            self.raiseError("Error on writing indentifier");
            return;
        };
        self.emitByte(@intFromEnum(chunk.Opcode.OP_DEFINE_VAR));
        self.emitByte(add);
        self.consume(.TOKEN_SEMI_COLON);
    }

    fn funcDeclaration(self: *Self, isAsync: bool) void {
        self.consume(.TOKEN_IDENTIFIER);
        const jump = self.emitJump(@intFromEnum(chunk.Opcode.OP_JUMP));

        const funcName = self.prev.content;
        const funcAddr = self.c.*.code.items.len;

        self.functions.put(funcName, .{
            .addr=funcAddr,
            .isAsync=isAsync
        }) catch {
            self.raiseError("Error on storing function");
            return;
        };

        var functionScope = Scope{
            .variables = std.StringHashMap(LocalVar).init(self.allocator),
            .isFunction = true,
        };
        var paramCount: u8 = 0;
        self.consume(.TOKEN_LEFT_PAREN);

        if (self.curr.type == .TOKEN_IDENTIFIER) {
            self.declareParameter(&functionScope, paramCount);
            paramCount += 1;
        }
        while (self.match(.TOKEN_COMMA)) {
            self.declareParameter(&functionScope, paramCount);
            paramCount += 1;
        }
        self.consume(.TOKEN_RIGHT_PAREN);

        self.emitByte(@intFromEnum(chunk.Opcode.OP_DEFINE_LOCAL));
        self.emitByte(paramCount);  // VM uses this to set up frame

        self.scopes.append(self.allocator, functionScope) catch {
            self.raiseError("Error creating function scope");
            return;
        };
        self.statement();

        self.emitByte(@intFromEnum(chunk.Opcode.OP_RETURN));

        var scope = self.scopes.pop();
        if (scope != null) scope.?.variables.deinit();

        self.patchJump(jump);
    }

    fn declareParameter(self: *Self, scope: *Scope, index: u8) void {
        self.consume(.TOKEN_IDENTIFIER);
        const paramName = self.prev.content;

        if (self.match(.TOKEN_NUMBER_WORD)) {
        } else if (self.match(.TOKEN_CURRENCY_WORD)) {
        } else {
            self.raiseError("Expected type");
            return;
        }

        scope.*.variables.put(paramName, .{
            .index = index,
        }) catch {
            self.raiseError("Error declaring parameter");
        };
    }


    fn statement(self: *Self) void {
        if (self.match(.TOKEN_IF)) {
            self.ifStatement();
            //self.raiseError("Unimplemented");
        } else if (self.match(.TOKEN_WHILE)) {
            self.whileStatement();
        } else if (self.match(.TOKEN_FOREVER)) {
            self.foreverStatement();
        } else if (self.match(.TOKEN_FOREACH)) {
            self.foreachStatement();
        } else if (self.match(.TOKEN_REPEAT)) {
            self.repeatStatement();
        } else if (self.match(.TOKEN_LEFT_BRACE)) {
            self.blockStatement();
        } else {
            self.expression();
            self.consume(.TOKEN_SEMI_COLON);
            self.emitByte(@intFromEnum(chunk.Opcode.OP_POP));
        }
    }

    // ENCOUNTERING AN IF STATEMENT
    // IF STATMENTS USE JUMPS
    fn ifStatement(self: *Self) void {
        self.consume(.TOKEN_LEFT_PAREN);
        self.expression();
        self.consume(.TOKEN_RIGHT_PAREN);

        const offset = self.emitJump(@intFromEnum(chunk.Opcode.OP_JUMP_IF_FALSE));
        self.emitByte(@intFromEnum(chunk.Opcode.OP_POP));
        self.statement();
        const elseOffset = self.emitJump(@intFromEnum(chunk.Opcode.OP_JUMP));

        self.patchJump(offset);
        self.emitByte(@intFromEnum(chunk.Opcode.OP_POP));

        if (self.match(.TOKEN_ELSE)) self.statement();
        self.patchJump(elseOffset);
    }

    fn whileStatement(self: *Self) void {
        const pos = self.c.*.code.items.len;
        self.consume(.TOKEN_LEFT_PAREN);
        self.expression();
        self.consume(.TOKEN_RIGHT_PAREN);

        const offset = self.emitJump(@intFromEnum(chunk.Opcode.OP_JUMP_IF_FALSE));
        self.emitByte(@intFromEnum(chunk.Opcode.OP_POP));
        self.statement();
        self.emitByte(@intFromEnum(chunk.Opcode.OP_JUMP));

        self.emitByte(@truncate(pos >> 8));
        self.emitByte(@truncate(pos));

        self.patchJump(offset);
        self.emitByte(@intFromEnum(chunk.Opcode.OP_POP));
    }

    fn foreverStatement(self: *Self) void {
        const pos = self.c.*.code.items.len;
        self.statement();
        self.emitByte(@intFromEnum(chunk.Opcode.OP_JUMP));

        self.emitByte(@truncate(pos >> 8));
        self.emitByte(@truncate(pos));
    }

    fn repeatStatement(self: *Self) void {
        self.consume(.TOKEN_LEFT_PAREN);
        self.consume(.TOKEN_IDENTIFIER);
        const val = value.makeValue(self.prev) catch {
            self.raiseError("Unable To Make indentifier");
            return;
        };

        const add = self.c.*.writeConstant(val) catch {
            self.raiseError("Error on writing indentifier");
            return;
        };

        self.expression();
        self.emitByte(@intFromEnum(chunk.Opcode.OP_DEFINE_VAR));
        self.emitByte(add);
        self.consume(.TOKEN_RIGHT_PAREN);

        const pos = self.c.*.code.items.len;

        self.emitByte(@intFromEnum(chunk.Opcode.OP_GET_VAR));
        self.emitByte(add);
        self.emitConstant(.{.number=0});
        self.emitByte(@intFromEnum(chunk.Opcode.OP_GREATER));

        const offset = self.emitJump(@intFromEnum(chunk.Opcode.OP_JUMP_IF_FALSE));
        self.emitByte(@intFromEnum(chunk.Opcode.OP_POP));
        self.statement();

        self.emitByte(@intFromEnum(chunk.Opcode.OP_GET_VAR));
        self.emitByte(add);
        self.emitConstant(.{.number=1});
        self.emitByte(@intFromEnum(chunk.Opcode.OP_SUBTRACT));
        self.emitByte(@intFromEnum(chunk.Opcode.OP_SET_VAR));
        self.emitByte(add);

        self.emitByte(@intFromEnum(chunk.Opcode.OP_JUMP));
        self.emitByte(@truncate(pos >> 8));
        self.emitByte(@truncate(pos));


        self.patchJump(offset);
        self.emitByte(@intFromEnum(chunk.Opcode.OP_POP));
    }

    fn foreachStatement(self: *Self) void {
        self.consume(.TOKEN_IDENTIFIER);
        const paramName = self.prev.content;

        var scope = Scope{
            .variables = std.StringHashMap(LocalVar).init(self.allocator),
            .isFunction = true,
        };
        scope.variables.put(paramName, .{
            .index = 0,
        }) catch {
            self.raiseError("Error declaring parameter");
        };

        const curr = cry.Currency.getFirst() catch {
            self.raiseError("Unable to get value");
            unreachable;
        };
        self.emitConstant(.{.currency=curr});
        self.emitByte(@intFromEnum(chunk.Opcode.OP_DEFINE_LOCAL));
        self.emitByte(1);

        self.scopes.append(self.allocator, scope) catch {
            self.raiseError("Error creating function scope");
            return;
        };

        const jump = self.emitJump(@intFromEnum(chunk.Opcode.OP_JUMP));

        const pos = self.c.*.code.items.len;
        self.emitByte(@intFromEnum(chunk.Opcode.OP_POP));
        self.emitByte(@intFromEnum(chunk.Opcode.OP_SET_LOCAL));
        self.emitByte(0);

        self.patchJump(jump);
        self.statement();

        self.emitByte(@intFromEnum(chunk.Opcode.OP_GET_LOCAL));
        self.emitByte(0);
        self.emitByte(@intFromEnum(chunk.Opcode.OP_INCREMENT));
        self.emitByte(@intFromEnum(chunk.Opcode.OP_NOT));
        self.emitByte(@intFromEnum(chunk.Opcode.OP_JUMP_IF_FALSE));
        self.emitByte(@truncate(pos >> 8));
        self.emitByte(@truncate(pos));


        scope = self.scopes.pop().?;
        scope.variables.deinit();
    }

    // ENCOUNTERING {
    fn blockStatement(self: *Self) void {
        while (!self.check(.TOKEN_RIGHT_BRACE) and !self.check(.TOKEN_EOF)) {
            self.declaration();
        }

        self.consume(.TOKEN_RIGHT_BRACE);
    }

    // AN EXPRESSION HAS NO PRECENDENCE SOME PARSE ALL POSSIBLE EXPRESSIONS
    fn expression(self: *Self) void {
        self.parseExpression(.PREC_ASSINGMENT);
    }

    // PARSE EXPRESSION WITH A CERTAIN PRECENDENCE
    // FIRST RUN INFIX METHOD OF CURRENT TOKEN FROM TABLE
    // THEN LOOP AND RUN INFIX
    fn parseExpression(self: *Self, precedence: Precendence) void {
        self.advance();
        var rule = getRule(self.prev.type);
        const prefixRule = rule.prefixFn;
        const canAssign = @intFromEnum(precedence) <= @intFromEnum(Precendence.PREC_ASSINGMENT);

        if (prefixRule) |func| {
            func(self, canAssign);
        } else {
            self.raiseError("Error on parse expression");
            return;
        }

        rule = getRule(self.curr.type);

        while (@intFromEnum(precedence) <= @intFromEnum(rule.precedence)) {
            self.advance();
            const infixRule = getRule(self.prev.type).infixFn;
            if (infixRule) |func| {
                func(self, canAssign);
            }
            if (canAssign and (self.match(.TOKEN_EQUALS)
                    or self.match(.TOKEN_ADD_EQUAL)
                    or self.match(.TOKEN_SUBTRACT_EQUAL))) {
                self.raiseError("Invalid Target");
            }
            rule = getRule(self.curr.type);
        }
    }

    // IF ENCOUNTERING A NUMBER TOKEN ADD
    // IT TO CONSTANTS
    fn number(self: *Self, _: bool) void {
        const val = value.makeValue(self.prev)
            catch {
                self.raiseError("Error on number");
                return;
            };
        self.emitConstant(val);
    }

    // IF ENCOUNTERING A CURRENCY TOKEN
    // ADD IT TO CONSTANTS
    fn currency(self: *Self, _: bool) void {
        const val = value.makeValue(self.prev)
            catch {
                self.raiseError("Error on currency");
                return;
            };
        self.emitConstant(val);
    }

    // ALL OPENING (LEFT) BRACKETS SHOULD HAVE A CLOSING BRACKET
    fn grouping(self: *Self, _: bool) void {
        self.expression();
        self.consume(.TOKEN_RIGHT_PAREN);
    }

    // IF ENCOUNTERING A INDENTIFIER WITHOUT A VAR
    // AKA GET VAR
    fn variable(self: *Self, canAssign: bool) void {
        if (self.curr.type == .TOKEN_LEFT_PAREN) {
            self.function(false);
            return;
        }

        const varName = self.prev.content;

        if (self.scopes.items.len > 0) {
            const scope = &self.scopes.items[self.scopes.items.len - 1];
            if (scope.variables.get(varName)) |localVar| {
                if (canAssign and self.match(.TOKEN_COLON_EQUAL)) {
                    self.expression();
                    self.emitByte(@intFromEnum(chunk.Opcode.OP_SET_LOCAL));
                    self.emitByte(localVar.index);
                } else if (canAssign and self.match(.TOKEN_ADD_EQUAL)) {
                    self.emitByte(@intFromEnum(chunk.Opcode.OP_GET_LOCAL));
                    self.emitByte(localVar.index);
                    self.expression();
                    self.emitByte(@intFromEnum(chunk.Opcode.OP_ADD));
                    self.emitByte(@intFromEnum(chunk.Opcode.OP_SET_LOCAL));
                    self.emitByte(localVar.index);
                } else if (canAssign and self.match(.TOKEN_SUBTRACT_EQUAL)) {
                    self.emitByte(@intFromEnum(chunk.Opcode.OP_GET_LOCAL));
                    self.emitByte(localVar.index);
                    self.expression();
                    self.emitByte(@intFromEnum(chunk.Opcode.OP_SUBTRACT));
                    self.emitByte(@intFromEnum(chunk.Opcode.OP_SET_LOCAL));
                    self.emitByte(localVar.index);
                } else {
                    self.emitByte(@intFromEnum(chunk.Opcode.OP_GET_LOCAL));
                    self.emitByte(localVar.index);
                }
                return;
            }
        }

        const val = value.makeValue(self.prev) catch {
            self.raiseError("Unable To Make indentifier");
            return;
        };

        if (!self.c.*.hasConstant(val)) {
            self.raiseError("Indentifier does not exist");
            return;
        }
        const add = self.c.*.writeConstant(val) catch {
            self.raiseError("Error on writing indentifier");
            return;
        };
        if (canAssign and self.match(.TOKEN_COLON_EQUAL)) {
            self.expression();
            self.emitByte(@intFromEnum(chunk.Opcode.OP_SET_VAR));
        } else if (canAssign and self.match(.TOKEN_ADD_EQUAL)) {
            self.expression();
            self.emitByte(@intFromEnum(chunk.Opcode.OP_GET_VAR));
            self.emitByte(add);
            self.emitByte(@intFromEnum(chunk.Opcode.OP_ADD));
            self.emitByte(@intFromEnum(chunk.Opcode.OP_SET_VAR));
        } else if (canAssign and self.match(.TOKEN_SUBTRACT_EQUAL)) {
            self.emitByte(@intFromEnum(chunk.Opcode.OP_GET_VAR));
            self.emitByte(add);
            self.expression();
            self.emitByte(@intFromEnum(chunk.Opcode.OP_SUBTRACT));
            self.emitByte(@intFromEnum(chunk.Opcode.OP_SET_VAR));
        } else {
            self.emitByte(@intFromEnum(chunk.Opcode.OP_GET_VAR));
        }
        self.emitByte(add);
    }

    fn function(self: *Self, awaiting: bool) void {
        const funcName = self.prev.content;
        self.consume(.TOKEN_LEFT_PAREN);

        var argCount: u8 = 0;
        if (!self.check(.TOKEN_RIGHT_PAREN)) {
            self.expression();
            argCount += 1;
            while (self.match(.TOKEN_COMMA)) {
                self.expression();
                argCount += 1;
            }
        }
        self.consume(.TOKEN_RIGHT_PAREN);

        if (self.nativeFunctions.get(funcName)) |index| {
            const native = @import("native.zig");
            if (native.NATIVE_FUNCTIONS[index].paramCount != argCount) {
                self.raiseError("Invalid argument count for native function");
                return;
            }

            const nativeIndex: usize = @intCast(index);
            self.emitByte(@intFromEnum(chunk.Opcode.OP_CALL_NATIVE));
            self.emitByte(@truncate(nativeIndex >> 8));
            self.emitByte(@truncate(nativeIndex & 0xFF));
            return;
        }

        if (self.functions.get(funcName)) |func| {
            if (func.isAsync and !awaiting) {
                self.emitByte(@intFromEnum(chunk.Opcode.OP_ASYNC_CALL));
            } else {
                self.emitByte(@intFromEnum(chunk.Opcode.OP_CALL));
            }
            self.emitByte(@truncate(func.addr >> 8));
            self.emitByte(@truncate(func.addr & 0xFF));
            return;
        }

        self.raiseError("Undefined function");
    }

    fn @"await"(self: *Self, _: bool) void {
        self.consume(.TOKEN_IDENTIFIER);
        self.function(true);
    }

    fn stop(self: *Self, _: bool) void {
        self.emitByte(@intFromEnum(chunk.Opcode.OP_STOP));
    }

    // UNARY OPERATORS
    // NEGATE AND BOOLEAN
    fn unary(self: *Self, _: bool) void {
        const operType = self.prev.type;
        self.parseExpression(.PREC_UNARY);

        switch(operType) {
            .TOKEN_SUBTRACT => self.emitByte(@intFromEnum(chunk.Opcode.OP_NEGATE)),
            .TOKEN_NOT => self.emitByte(@intFromEnum(chunk.Opcode.OP_NOT)),
            else => return
        }
    }

    // BINARY OPERATORS
    fn binary(self: *Self, _: bool) void {
        const operType = self.prev.type;
        const rule = getRule(operType);
        self.parseExpression(@enumFromInt(@intFromEnum(rule.precedence) + 1));

        switch (operType) {
            .TOKEN_ADD => self.emitByte(@intFromEnum(chunk.Opcode.OP_ADD)),
            .TOKEN_SUBTRACT => self.emitByte(@intFromEnum(chunk.Opcode.OP_SUBTRACT)),
            .TOKEN_MULTIPLY => self.emitByte(@intFromEnum(chunk.Opcode.OP_MULTIPLY)),
            .TOKEN_DIVIDE => self.emitByte(@intFromEnum(chunk.Opcode.OP_DIVIDE)),
            .TOKEN_EQUALS => self.emitByte(@intFromEnum(chunk.Opcode.OP_EQUALS)),
            .TOKEN_BANG_EQUAL => {
                self.emitByte(@intFromEnum(chunk.Opcode.OP_EQUALS));
                self.emitByte(@intFromEnum(chunk.Opcode.OP_NOT));
            },
            .TOKEN_GREATER => self.emitByte(@intFromEnum(chunk.Opcode.OP_GREATER)),
            .TOKEN_GREATER_EQUAL => {
                self.emitByte(@intFromEnum(chunk.Opcode.OP_LESS));
                self.emitByte(@intFromEnum(chunk.Opcode.OP_NOT));
            },
            .TOKEN_LESS => self.emitByte(@intFromEnum(chunk.Opcode.OP_LESS)),
            .TOKEN_LESS_EQUAL => {
                self.emitByte(@intFromEnum(chunk.Opcode.OP_GREATER));
                self.emitByte(@intFromEnum(chunk.Opcode.OP_NOT));
            },
            else => return
        }
    }

    fn @"and"(self: *Self, _: bool) void {
       const jump = self.emitJump(@intFromEnum(chunk.Opcode.OP_JUMP_IF_FALSE));
       self.emitByte(@intFromEnum(chunk.Opcode.OP_POP));
       self.parseExpression(.PREC_AND);
       self.patchJump(jump);
    }

    fn @"or"(self: *Self, _: bool) void {
        const elseJump = self.emitJump(@intFromEnum(chunk.Opcode.OP_JUMP_IF_FALSE));
        const jump = self.emitJump(@intFromEnum(chunk.Opcode.OP_JUMP));

        self.patchJump(elseJump);
        self.emitByte(@intFromEnum(chunk.Opcode.OP_POP));
        self.parseExpression(.PREC_OR);
        self.patchJump(jump);
    }


    // FUNCTIONS FOR WRITING TO CHUNK

    // ADD BYTE TO CHUNK
    fn emitByte(self: *Self, byte: u8) void {
        self.c.*.writeChunk(byte) catch {
            self.raiseError("Error on writing byte");
            return;
        };
    }

    // TO ADD A CONSTANT FIRST WRITE CONSTANT
    // THEN ADD OP_CONSTANT THEN ADDRESS
    fn emitConstant(self: *Self, val: value.Value) void {
        const add = self.c.*.writeConstant(val) catch {
            self.raiseError("Eror on writing constant");
            return;
        };
        self.emitByte(@intFromEnum(chunk.Opcode.OP_CONSTANT));
        self.emitByte(add);
    }

    fn emitJump(self: *Self, byte: u8) usize {
        self.emitByte(byte);
        self.emitByte(0xFF);
        self.emitByte(0xFF);
        return self.c.*.code.items.len - 2;
    }

    fn patchJump(self: *Self, offset: usize) void {
        const jump: usize = self.c.*.code.items.len;
        if (jump > 0xFFFF) {
            self.raiseError("Jump too big");
        }
        self.c.*.code.items[offset] = @truncate((jump >> 8) & 0xFF);
        self.c.*.code.items[offset+1] = @truncate(jump & 0xFF);
    }
};
