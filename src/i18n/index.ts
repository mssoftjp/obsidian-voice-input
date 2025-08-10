/**
 * 翻訳リソースのエクスポート
 */
import { ja } from './ja';
import { en } from './en';
import { zh } from './zh';
import { ko } from './ko';
import { Locale, TranslationResource } from '../interfaces';

export const translations: Record<Locale, TranslationResource> = {
    ja,
    en,
    zh,
    ko
};

export { ja, en, zh, ko };
