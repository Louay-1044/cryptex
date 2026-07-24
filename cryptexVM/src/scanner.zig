const std = @import("std");

pub const TokenType = enum {
    // SINGLE CHAR
    TOKEN_LEFT_PAREN, TOKEN_RIGHT_PAREN,
    TOKEN_LEFT_BRACE, TOKEN_RIGHT_BRACE,
    TOKEN_MULTIPLY, TOKEN_MOD,
    TOKEN_COMMA, TOKEN_DOT, TOKEN_SEMI_COLON,

    // DOUBLE CHAR
    TOKEN_BANG_EQUAL,
    TOKEN_EQUALS,
    TOKEN_COLON_EQUAL,

    // SINGLE OR DOUBLE CHAR
    TOKEN_ADD, TOKEN_ADD_EQUAL,
    TOKEN_SUBTRACT, TOKEN_SUBTRACT_EQUAL,
    TOKEN_GREATER, TOKEN_GREATER_EQUAL,
    TOKEN_LESS, TOKEN_LESS_EQUAL,
    TOKEN_DIVIDE, TOKEN_DIV,

    // LITERALS
    TOKEN_IDENTIFIER, TOKEN_BOOLEAN, TOKEN_CURRENCY, TOKEN_NUMBER,

    // KEYWORDS
    TOKEN_AND, TOKEN_OR, TOKEN_NOT,
    TOKEN_VAR, TOKEN_FUNC,
    TOKEN_STOP,
    TOKEN_REPEAT, TOKEN_FOREVER, TOKEN_WHILE, TOKEN_FOREACH,
    TOKEN_IF, TOKEN_ELSE,
    TOKEN_NUMBER_WORD, TOKEN_CURRENCY_WORD,

    TOKEN_ASYNC, TOKEN_AWAIT,

    TOKEN_ERR, TOKEN_EOF
};

// CODE IS MADE UP OF TOKENS
// EACH TOKEN HAS TOKEN TYPE AND CONTENT
pub const Token = struct {
    type: TokenType,
    content: []const u8,

    pub fn init(typ: TokenType, content: []const u8) Token {
        return .{
            .type = typ,
            .content = content,
        };
    }
};

// CHAR_CLASS_TABLE IS USED TO QUICKLY CHECK
// WHAT TYPE A CHAR IS:
const CharType = enum(u8) {
    OTHER = 0,
    DIGIT = 1,
    ALPHA = 2,
    WHITESPACE = 4,
    OPERATOR = 8,
};

const CHAR_CLASS_TABLE: [256]u8 = init: {
    var table: [256]u8 = undefined;

    for (0..256) |i| {
        const c = @as(u8, @intCast(i));
        var class: u8 = 0;

        if (c >= '0' and c <= '9')
            class |= @intFromEnum(CharType.DIGIT);
        if ((c >= 'a' and c <= 'z')
            or (c >= 'A' and c <= 'Z')
            or c == '_' or c == '.')
            class |= @intFromEnum(CharType.ALPHA);
        if (c == ' ' or  c == '\t' or c == '\n' or c == '\r')
            class |= @intFromEnum(CharType.WHITESPACE);
        if (c == '+' or c == '-'
            or c == '*' or c == '/'
            or c == '=' or c == '%'
            or c == ':')
            class |= @intFromEnum(CharType.OPERATOR);

        table[i] = class;
    }

    break :init table;
};

inline fn isDigit(c: u8) bool {
    return (CHAR_CLASS_TABLE[c] & @intFromEnum(CharType.DIGIT)) != 0;
    //return (c >= '0' and c <= '9');
}

inline fn isAlpha(c: u8) bool {
    return (CHAR_CLASS_TABLE[c] & @intFromEnum(CharType.ALPHA)) != 0;
    //return ((c >= 'a' and c <= 'z')
    //  or (c >= 'A' and c <= 'Z')
    //  or c == '_');
}

inline fn isWhiteSpace(c: u8) bool {
    return (CHAR_CLASS_TABLE[c] & @intFromEnum(CharType.WHITESPACE)) != 0;
}

// A SCANNER TAKES IN A SOURCE CODE
// EACH TIME A SCANTOKEN() IS CALLED IT RETURNS NEXT TOKEN
// INSTEAD OF DURING IT ALL IN ONE BATCH
pub const Scanner = struct {
    const Self = @This();

    start: []const u8,
    current: usize = 0,
    source: []const u8,

    pub fn init(source: []const u8) Self {
        return .{
            .start = source,
            .source = source,
        };

    }

    // SCAN TOKEN IS MAIN METHOD
    // RETURNS NEXT TOKEN IN SOURCE CODE
    pub fn scanToken(self: *Self) Token{
        self.skipWhitespace();
        self.start = self.start[self.current..];
        self.current = 0;

        // END OF FILE
        if (self.isAtEnd()) {
            return self.makeToken(.TOKEN_EOF);
        }

        const c = self.advance();
        switch (c) {
            // SINGLE CHAR
            '(' => return self.makeToken(.TOKEN_LEFT_PAREN),
            ')' => return self.makeToken(.TOKEN_RIGHT_PAREN),
            '{' => return self.makeToken(.TOKEN_LEFT_BRACE),
            '}' => return self.makeToken(.TOKEN_RIGHT_BRACE),
            '*' => return self.makeToken(.TOKEN_MULTIPLY),
            '%' => return self.makeToken(.TOKEN_MOD),
            '.' => return self.makeToken(.TOKEN_DOT),
            ',' => return self.makeToken(.TOKEN_COMMA),
            ';' => return self.makeToken(.TOKEN_SEMI_COLON),

            // DOUBLE CHAR
            '!' => return self.checkDoubleToken('=', .TOKEN_BANG_EQUAL),
            '=' => return self.checkDoubleToken('=', .TOKEN_EQUALS),
            ':' => return self.checkDoubleToken('=', .TOKEN_COLON_EQUAL),

            // SINGLE OR DOUBLE CHAR
            '+' => return self.checkDoubleOrSingleToken('=', .TOKEN_ADD_EQUAL, .TOKEN_ADD),
            '-' => return self.checkDoubleOrSingleToken('=', .TOKEN_SUBTRACT_EQUAL, .TOKEN_SUBTRACT),
            '>' => return self.checkDoubleOrSingleToken('=', .TOKEN_GREATER_EQUAL, .TOKEN_GREATER),
            '<' => return self.checkDoubleOrSingleToken('=', .TOKEN_LESS_EQUAL, .TOKEN_LESS),
            '/' => return self.checkDoubleOrSingleToken('/', .TOKEN_DIV, .TOKEN_DIVIDE),

            '\'' => return self.currency(),

            else => {
                if (isDigit(c)) {
                    return self.number();
                } else if (isAlpha(c)) {
                    return self.identifier();
                } else {
                    return self.raiseErr();
                }
            }
        }

        // UNEXPECTED TOKEN
        return self.raiseErr();
    }

    // RETURNS A NEWLY MADE TOKEN FROM TYPE
    fn makeToken(self: *Self, typ: TokenType) Token {
        return Token.init(
            typ,
            self.start[0..self.current],
        );
    }

    // CREATES A CURRENCY TOKEN
    fn currency(self: *Self) Token {
        while(self.peek() != '\'' and self.peek() != 0) {
            _ = self.advance();
        }

        if (self.peek() == 0) {
            return self.raiseErr();
        }
        _ = self.advance();
        return self.makeToken(.TOKEN_CURRENCY);
    }

    // DOUBLE TOKENS ARE MADE UP OF TWO CHARS LIKE ==, !=, :=
    fn checkDoubleToken(self: *Self, exp: u8, typ: TokenType) Token {
        if (self.match(exp)) {
            return self.makeToken(typ);
        }
        return self.raiseErr();
    }

    // SOME TOKENS START WITH SAME CHAR AS OTHERS LIKE +, AND +=
    fn checkDoubleOrSingleToken(self: *Self, exp: u8, typ: TokenType, alt: TokenType) Token {
        if (self.match(exp)) {
            return self.makeToken(typ);
        }
        return self.makeToken(alt);
    }

    fn raiseErr(self: *Self) Token{
        //std.process.exit(100);
        return self.makeToken(.TOKEN_ERR);
    }

    // IS END OF SOURCE CODE?
    fn isAtEnd(self: *Self) bool {
        return self.start.len == 0 or self.current >= self.start.len;
    }

    // MOVE TO NEXT CHAR IN SOURCE CODE
    fn advance(self: *Self) u8 {
        self.current += 1;
        return self.start[self.current - 1];
    }

    // LOOK AT NEXT CHAR WHITHOUT ADVANCING
    fn peek(self: *Self) u8 {
        if (self.isAtEnd()) {
            return 0;
        }

        return self.start[self.current];
    }

    // LOOK FOWARD TWO SPACE
    fn peekNext(self: *Self) u8 {
        if (self.isAtEnd()) {
            return 0;
        }

        if (self.current + 1 >= self.start.len) {
            return 0;
        }

        return self.start[self.current + 1];
    }


    // SKIP WHITESPACE CHARS
    fn skipWhitespace(self: *Self) void {
        while (true) {
            const c = self.peek();
            if (!isWhiteSpace(c)) {
                break;
            }
            _ = self.advance();
        }
    }

    // CHECK IF BYTE IS AS EXPECTED
    fn match(self: *Self, exp: u8) bool {
        if (self.isAtEnd()) return false;
        if (self.start[self.current] != exp) return false;
        self.current += 1;
        return true;
    }

    // CREATE A NUMBER TOKEN
    // FROM SOURCE CODE NUMBER TOKEN MEANING SOURCE CODE REPRESENTS A CONSTANT
    fn number(self: *Self) Token {
        while (isDigit(self.peek())) {
            _ = self.advance();
        }

        if (self.peek() == '.' and isDigit(self.peekNext())) {
            _ = self.advance();

            while (isDigit(self.peek())) {
                _ = self.advance();
            }
        }

        return self.makeToken(.TOKEN_NUMBER);
    }

    // KEY WORDS
    fn identifier(self: *Self) Token {
        while (isAlpha(self.peek()) or isDigit(self.peek())) {
            _ = self.advance();
        }

        return self.identifierType();
    }

    fn identifierType(self: *Self) Token {
        switch (self.start[0]) {
            'a' => {
                switch (self.start[1]) {
                    'n' => return self.checkKeyword(1, "nd", .TOKEN_AND),
                    's' => return self.checkKeyword(1, "sync", .TOKEN_ASYNC),
                    'w' => return self.checkKeyword(1, "wait", .TOKEN_AWAIT),
                    else => {},
                }
            },
            //'b' => return self.checkKeyword(1, "oolean", .TOKEN_BOOLEAN),
            'c' => return self.checkKeyword(1, "urrency", .TOKEN_CURRENCY_WORD),
            'e' => return self.checkKeyword(1, "lse", .TOKEN_ELSE),
            'f' => {
                if (self.start[1] == 'n') {
                    return self.checkKeyword(1, "n", .TOKEN_FUNC);
                } else if (self.start[1] == 'o') {
                    if (self.start[4] == 'a') return self.checkKeyword(1, "oreach", .TOKEN_FOREACH);
                    if (self.start[4] == 'v') return self.checkKeyword(1, "orever", .TOKEN_FOREVER);
                }
            },
            'i' => return self.checkKeyword(1, "f", .TOKEN_IF),
            'n' => {
                if (self.start[1] == 'o') return self.checkKeyword(1, "ot", .TOKEN_NOT);
                if (self.start[1] == 'u') return self.checkKeyword(1, "umber", .TOKEN_NUMBER_WORD);
            },
            'o' => return self.checkKeyword(1, "r", .TOKEN_OR),
            'r' => return self.checkKeyword(1, "epeat", .TOKEN_REPEAT),
            's' => return self.checkKeyword(1, "top", .TOKEN_STOP),
            'v' => return self.checkKeyword(1, "ar", .TOKEN_VAR),
            'w' => return self.checkKeyword(1, "hile", .TOKEN_WHILE),
            else => {},
        }

        return self.makeToken(.TOKEN_IDENTIFIER);
    }


    fn checkKeyword(self: *Self, start: usize, rest: []const u8, typ: TokenType) Token {
        const length = rest.len;
        if (start + length >= self.start[start..].len) {
            return self.makeToken(.TOKEN_IDENTIFIER);
        }
        const s = self.start[start.. start + length];
        if (self.current == start + length and std.mem.eql(u8, s, rest)) {
            return self.makeToken(typ);
        }

        return self.makeToken(.TOKEN_IDENTIFIER);
    }

};
