const PBKDF2_ITERATIONS = 310000;
const HASH_LENGTH = 256;
const SALT_LENGTH = 16;

export async function onRequestPost(context) {
    try {
        const body = await context.request.json();

        const username = body.username?.trim();
        const password = body.password;

        if (!username || typeof password !== "string") {
            return Response.json(
                {
                    error: "Username and password are required.",
                    step: "validation"
                },
                { status: 400 }
            );
        }

        if (username.length < 3 || username.length > 30) {
            return Response.json(
                {
                    error: "Username must be between 3 and 30 characters.",
                    step: "validation"
                },
                { status: 400 }
            );
        }

        if (!/^[A-Za-z0-9_-]+$/.test(username)) {
            return Response.json(
                {
                    error: "Username may only contain letters, numbers, underscores, and hyphens.",
                    step: "validation"
                },
                { status: 400 }
            );
        }

        if (password.length < 8) {
            return Response.json(
                {
                    error: "Password must be at least 8 characters long.",
                    step: "validation"
                },
                { status: 400 }
            );
        }

        const existingUser = await context.env.DB
            .prepare(`
                SELECT id
                FROM users
                WHERE username = ?
            `)
            .bind(username)
            .first();

        if (existingUser) {
            return Response.json(
                {
                    error: "That username is already in use.",
                    step: "database-check"
                },
                { status: 409 }
            );
        }

        const salt = new Uint8Array(SALT_LENGTH);

        crypto.getRandomValues(salt);

        const passwordKey = await crypto.subtle.importKey(
            "raw",
            new TextEncoder().encode(password),
            "PBKDF2",
            false,
            ["deriveBits"]
        );

        const derivedBits = await crypto.subtle.deriveBits(
            {
                name: "PBKDF2",
                salt,
                iterations: PBKDF2_ITERATIONS,
                hash: "SHA-256"
            },
            passwordKey,
            HASH_LENGTH
        );

        const saltBase64 = bytesToBase64(salt);

        const hashBase64 = bytesToBase64(
            new Uint8Array(derivedBits)
        );

        const passwordHash = [
            "pbkdf2",
            "sha256",
            PBKDF2_ITERATIONS,
            saltBase64,
            hashBase64
        ].join("$");

        const result = await context.env.DB
            .prepare(`
                INSERT INTO users (
                    username,
                    password_hash
                )
                VALUES (?, ?)
            `)
            .bind(username, passwordHash)
            .run();

        return Response.json({
            success: true,
            user: {
                id: result.meta.last_row_id,
                username
            }
        });

    } catch (error) {

        console.error("Registration error:", error);

        return Response.json(
            {
                error: error.message || "Unable to create account.",
                error_name: error.name || "UnknownError",
                step: "server"
            },
            { status: 500 }
        );
    }
}

function bytesToBase64(bytes) {

    let binary = "";

    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }

    return btoa(binary);

}
