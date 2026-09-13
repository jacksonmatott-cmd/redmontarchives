const SESSION_DAYS = 7;

export async function onRequestPost(context) {
    try {
        const body = await context.request.json();

        const username = body.username?.trim();
        const password = body.password;

        if (!username || typeof password !== "string") {
            return Response.json(
                {
                    error: "Username and password are required."
                },
                { status: 400 }
            );
        }

        const user = await context.env.DB
            .prepare(`
                SELECT id, username, password_hash
                FROM users
                WHERE username = ?
            `)
            .bind(username)
            .first();

        if (!user || !user.password_hash) {
            return Response.json(
                {
                    error: "Invalid username or password."
                },
                { status: 401 }
            );
        }

        const validPassword = await verifyPassword(
            password,
            user.password_hash
        );

        if (!validPassword) {
            return Response.json(
                {
                    error: "Invalid username or password."
                },
                { status: 401 }
            );
        }

        const sessionToken = createSessionToken();
        const sessionTokenHash =
            await sha256Base64Url(sessionToken);

        const expiresAt = new Date(
            Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000
        ).toISOString();

        await context.env.DB
            .prepare(`
                INSERT INTO sessions (
                    user_id,
                    session_token_hash,
                    expires_at
                )
                VALUES (?, ?, ?)
            `)
            .bind(
                user.id,
                sessionTokenHash,
                expiresAt
            )
            .run();

        return new Response(
            JSON.stringify({
                success: true,
                user: {
                    id: user.id,
                    username: user.username
                }
            }),
            {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                    "Set-Cookie":
                        `redmont_session=${sessionToken}; ` +
                        `Max-Age=${SESSION_DAYS * 24 * 60 * 60}; ` +
                        `Path=/; ` +
                        `HttpOnly; ` +
                        `Secure; ` +
                        `SameSite=Lax`
                }
            }
        );

    } catch (error) {

        console.error("Login error:", error);

        return Response.json(
            {
                error: "Unable to log in."
            },
            { status: 500 }
        );
    }
}

async function verifyPassword(password, storedHash) {

    const parts = storedHash.split("$");

    if (parts.length !== 5) {
        return false;
    }

    const [
        algorithm,
        hashAlgorithm,
        iterationsText,
        saltBase64,
        storedKeyBase64
    ] = parts;

    if (
        algorithm !== "pbkdf2" ||
        hashAlgorithm !== "sha256"
    ) {
        return false;
    }

    const iterations = Number(iterationsText);

    if (
        !Number.isInteger(iterations) ||
        iterations <= 0 ||
        iterations > 100000
    ) {
        return false;
    }

    const salt = base64ToBytes(saltBase64);
    const storedKey = base64ToBytes(storedKeyBase64);

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
            iterations,
            hash: "SHA-256"
        },
        passwordKey,
        storedKey.length * 8
    );

    const derivedKey = new Uint8Array(derivedBits);

    return constantTimeEqual(
        derivedKey,
        storedKey
    );
}

function constantTimeEqual(a, b) {

    if (a.length !== b.length) {
        return false;
    }

    let difference = 0;

    for (let i = 0; i < a.length; i++) {
        difference |= a[i] ^ b[i];
    }

    return difference === 0;
}

function createSessionToken() {

    const bytes = new Uint8Array(32);

    crypto.getRandomValues(bytes);

    return bytesToBase64Url(bytes);
}

async function sha256Base64Url(value) {

    const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(value)
    );

    return bytesToBase64Url(
        new Uint8Array(digest)
    );
}

function base64ToBytes(value) {

    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
}

function bytesToBase64Url(bytes) {

    let binary = "";

    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }

    return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
}
