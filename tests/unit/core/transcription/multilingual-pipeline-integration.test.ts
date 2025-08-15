import { StandardCleaningPipeline } from '../../../../src/core/transcription/cleaning/StandardCleaningPipeline';
import { PromptContaminationCleaner } from '../../../../src/core/transcription/cleaning/PromptContaminationCleaner';
import { UniversalRepetitionCleaner } from '../../../../src/core/transcription/cleaning/UniversalRepetitionCleaner';

describe('Multilingual Pipeline Integration', () => {
    let pipeline: StandardCleaningPipeline;

    beforeEach(() => {
        pipeline = new StandardCleaningPipeline([
            new PromptContaminationCleaner(),
            new UniversalRepetitionCleaner()
        ]);
    });

    // Helper function to simulate pre-stripping like TranscriptionService does
    const preStripTranscriptWrappers = (text: string): string => {
        let result = text;
        // Complete tag match
        const completeMatch = result.match(/<TRANSCRIPT[^>]*>\s*([\s\S]*?)\s*<\/TRANSCRIPT>/);
        if (completeMatch) {
            result = completeMatch[1];
        } else {
            // Opening tag only (missing closing tag)
            const openingMatch = result.match(/<TRANSCRIPT[^>]*>\s*([\s\S]*)/);
            if (openingMatch) {
                result = openingMatch[1];
            }
        }
        // Remove any remaining TRANSCRIPT tags
        result = result.replace(/<\/?TRANSCRIPT[^>]*>/gi, '');
        result = result.replace(/<\/?transcription[^>]*>/gi, '');
        return result;
    };

    describe('Complete flow (pre-strip + pipeline)', () => {
        it('EN: complete flow removes prompts/wrappers and keeps content', async () => {
            const input = `<TRANSCRIPT>
Please transcribe only the following audio content. Do not include this instruction in your output.
Record only the speaker's statements accurately.

Output format:
(Speaker content only)
Hello world, this is a test message.
</TRANSCRIPT>`;
            
            // Step 1: Pre-strip (simulating TranscriptionService behavior)
            const preStripped = preStripTranscriptWrappers(input);
            
            // Step 2: Pipeline cleaning
            const { finalText } = await pipeline.execute(preStripped, 'en', { 
                language: 'en', 
                originalLength: preStripped.length 
            });
            
            expect(finalText).toContain('Hello world, this is a test message');
            expect(finalText).not.toMatch(/<\/?TRANSCRIPT/i);
            expect(finalText).not.toMatch(/Please transcribe/);
            expect(finalText).not.toMatch(/Output format/);
            expect(finalText).not.toMatch(/Speaker content only/);
        });

        it('ZH: complete flow removes prompts/wrappers and keeps content', async () => {
            const input = `<TRANSCRIPT>
请仅转录以下音频内容。不要包含此指令在输出中。
请准确记录说话者的发言内容。

输出格式:
（仅说话者内容）
这是一个测试消息。
</TRANSCRIPT>`;
            
            const preStripped = preStripTranscriptWrappers(input);
            const { finalText } = await pipeline.execute(preStripped, 'zh', { 
                language: 'zh', 
                originalLength: preStripped.length 
            });
            
            expect(finalText).toContain('这是一个测试消息');
            expect(finalText).not.toMatch(/<\/?TRANSCRIPT/i);
            expect(finalText).not.toMatch(/请仅转录/);
            expect(finalText).not.toMatch(/输出格式/);
        });

        it('KO: complete flow removes prompts/wrappers and keeps content', async () => {
            const input = `<TRANSCRIPT>
다음 음성 내용만 전사해주세요. 이 지시사항을 출력에 포함하지 마세요.
화자의 발언 내용만 정확히 기록해주세요.

출력 형식:
（화자 발언만）
안녕하세요, 테스트 메시지입니다.
</TRANSCRIPT>`;
            
            const preStripped = preStripTranscriptWrappers(input);
            const { finalText } = await pipeline.execute(preStripped, 'ko', { 
                language: 'ko', 
                originalLength: preStripped.length 
            });
            
            expect(finalText).toContain('안녕하세요, 테스트 메시지입니다');
            expect(finalText).not.toMatch(/<\/?TRANSCRIPT/i);
            expect(finalText).not.toMatch(/다음 음성 내용만/);
            expect(finalText).not.toMatch(/출력 형식/);
        });

        it('JA: complete flow removes prompts/wrappers and keeps content (regression test)', async () => {
            const input = `<TRANSCRIPT>
以下の音声内容のみを文字に起こしてください。この指示文は出力に含めないでください。
話者の発言内容だけを正確に記録してください。

出力形式:
（話者の発言のみ）
こんにちは、テストメッセージです。
</TRANSCRIPT>`;
            
            const preStripped = preStripTranscriptWrappers(input);
            const { finalText } = await pipeline.execute(preStripped, 'ja', { 
                language: 'ja', 
                originalLength: preStripped.length 
            });
            
            expect(finalText).toContain('こんにちは、テストメッセージです');
            expect(finalText).not.toMatch(/<\/?TRANSCRIPT/i);
            expect(finalText).not.toMatch(/以下の音声内容/);
            expect(finalText).not.toMatch(/出力形式/);
        });
    });
});