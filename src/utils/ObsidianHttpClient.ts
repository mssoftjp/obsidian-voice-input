import { requestUrl } from 'obsidian';

/**
 * Obsidian環境でのHTTPクライアント
 *
 * CLAUDE.mdの哲学に従った設計:
 * - CORS制限を回避するObsidian APIを使用
 * - 共通のエラーハンドリング
 * - 型安全性の確保
 */
export class ObsidianHttpClient {
    /**
     * Low-level request helper returning status and parsed body
     */
    static async request(opts: {
        url: string;
        method?: string;
        headers?: Record<string, string>;
        body?: ArrayBuffer | string;
    }): Promise<{ status: number; json: unknown; text: string }> {
        const { url, method = 'GET', headers = {}, body } = opts;
        const res = await requestUrl({ url, method, headers, body, throw: false });
        const jsonBody: unknown = res.json;
        return { status: res.status, json: jsonBody, text: res.text };
    }

    /**
     * GET JSON helper
     */
    static async getJson(url: string, headers: Record<string, string> = {}) {
        return this.request({ url, method: 'GET', headers });
    }
    /**
     * JSONデータをPOSTリクエスト
     */
    static async postJson(url: string, data: unknown, headers: Record<string, string> = {}) {
        const res = await requestUrl({
            url,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...headers
            },
            body: JSON.stringify(data),
            throw: false
        });
        const jsonBody: unknown = res.json;
        return { status: res.status, json: jsonBody };
    }

    /**
     * FormDataをmultipart/form-dataとしてPOST
     */
    static async postFormData(url: string, formData: FormData, headers: Record<string, string> = {}) {
        const boundary = `----ObsidianFormBoundary${Math.random().toString(16).slice(2)}`;
        const body = await this.formDataToArrayBuffer(formData, boundary);

        const response = await requestUrl({
            url,
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                ...headers
            },
            body,
            throw: false
        });
        const jsonBody: unknown = response.json;
        return { status: response.status, json: jsonBody };
    }

    /**
     * FormDataをArrayBufferに変換
     */
    private static async formDataToArrayBuffer(formData: FormData, boundary: string): Promise<ArrayBuffer> {
        const textEncoder = new TextEncoder();
        const parts: Uint8Array[] = [];

        // FormDataのエントリーを配列に変換（TypeScript互換性のため）
        const entries: Array<[string, FormDataEntryValue]> = [];
        // FormData.prototype.entries() の代替実装
        formData.forEach((value, key) => {
            entries.push([key, value]);
        });

        for (const [name, value] of entries) {
            parts.push(textEncoder.encode(`--${boundary}\r\n`));

            if (value !== null && value !== undefined && typeof value === 'object' && 'arrayBuffer' in value) {
                const blobValue = value as File | Blob;
                const filename = blobValue instanceof File ? blobValue.name : 'blob';
                parts.push(textEncoder.encode(
                    `Content-Disposition: form-data; name="${name}"; filename="${filename}"\r\n` +
                    `Content-Type: ${blobValue.type || 'application/octet-stream'}\r\n\r\n`
                ));
                parts.push(new Uint8Array(await blobValue.arrayBuffer()));
            } else {
                parts.push(textEncoder.encode(
                    `Content-Disposition: form-data; name="${name}"\r\n\r\n` +
                    String(value)
                ));
            }
            parts.push(textEncoder.encode('\r\n'));
        }

        parts.push(textEncoder.encode(`--${boundary}--\r\n`));

        // すべてのパートを結合
        const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;

        for (const part of parts) {
            result.set(part, offset);
            offset += part.length;
        }

        return result.buffer;
    }
}
