# Language-Specific Dictionaries: Design Decisions Summary

## Key Decisions Made

### 1. Type Architecture Decision

**Chosen Approach**: Hybrid structure combining type safety with flexibility

```typescript
interface MultiLanguageDictionary {
  languages: {
    ja?: CorrectionEntry[];
    en?: CorrectionEntry[];
    zh?: CorrectionEntry[];
    ko?: CorrectionEntry[];
  };
  global: CorrectionEntry[];
}
```

**Rationale**:
- Maintains TypeScript type safety
- Allows optional language-specific dictionaries
- Clearly separates global vs language-specific rules
- Enables easy backward compatibility implementation

### 2. Fallback Order

**Priority**: `currentDetectedLanguage → global`

**Rationale**:
- Current language gets highest priority (most relevant)
- Global dictionary as fallback (language-agnostic rules)
- No English fallback by default to avoid inappropriate corrections across languages
- Optional English fallback can be enabled via setting (disabled by default) for users who prefer it

**Language Source**: Language detection is routed via `getResolvedLanguage()` which:
- Uses `transcriptionLanguage` setting when explicitly set
- Maps 'auto' setting to one of: ja/zh/ko/en based on plugin language detection
- Does NOT use UI/plugin interface language

### 3. Backward Compatibility Strategy

**Approach**: Automatic migration with preservation of existing data

- Legacy `SimpleCorrectionDictionary` → `MultiLanguageDictionary.global`
- No data loss during migration
- One-time conversion on first load with new format
- Always save in new format going forward

### 4. Dictionary Format and Security

**Dictionary Entry Format**: Literal string-to-string mappings only
```typescript
interface CorrectionEntry {
  patterns: string[];  // Literal strings, NOT regex patterns
  replacement: string; // Literal replacement text
  enabled: boolean;
}
```

**Important Safety Considerations**:
- Dictionary entries must be literal strings for safety and performance
- Regex patterns belong only to separate custom rules (not dictionary entries)
- Dictionary patterns are escaped when compiled to prevent injection
- Input validation prevents malicious patterns

**Performance Limits**:
```typescript
const LIMITS = {
  MAX_ENTRIES_PER_LANGUAGE: 1000,
  MAX_GLOBAL_ENTRIES: 500,
  MAX_PATTERN_LENGTH: 100,
  MAX_REPLACEMENT_LENGTH: 200,
  MAX_PATTERNS_PER_ENTRY: 10
};
```

**Performance Target**: <100ms processing time per text correction

### 5. UI Strategy

**Approach**: Tab-based language selection with minimal disruption

- Language tabs/filters in dictionary settings
- Clear indication of entry counts per language
- Enhanced import/export supporting both formats
- Migration notification for existing users

### 6. Implementation Phases

**Phase 1**: Core infrastructure and types (2-3 days)
**Phase 2**: UI enhancements (3-4 days)
**Phase 3**: Optimization and testing (1-2 days)

## Benefits of This Design

1. **Type Safety**: Full TypeScript support with compile-time checks
2. **Backward Compatibility**: No breaking changes for existing users
3. **Performance**: Efficient fallback logic with literal string matching and caching support
4. **Security**: Input validation, literal-only dictionary entries, and size limits prevent abuse
5. **Usability**: Intuitive language-based organization aligned with transcription language
6. **Extensibility**: Easy to add new languages in the future
7. **Safety**: Explicit separation of dictionary entries (literal) from custom rules (regex)

## Migration Impact

- **Existing Users**: Seamless transition with automatic migration
- **Performance**: No regression, potential improvement with language-specific rules
- **Storage**: Slightly larger format but more efficient language targeting
- **Learning Curve**: Minimal - existing workflow preserved with new capabilities

## Success Metrics

1. Zero data loss during migration
2. <100ms correction processing time maintained with literal string matching
3. Memory usage stays under 1MB for typical dictionaries
4. User adoption of language-specific features >50% within 3 months
5. No increase in user-reported issues post-implementation
6. Security: Zero regex injection vulnerabilities with literal-only dictionary entries

This design successfully balances the competing requirements of type safety, performance, backward compatibility, and user experience while providing a solid foundation for multi-language dictionary correction. The literal string approach ensures both safety and performance, while the simplified fallback strategy prevents inappropriate cross-language corrections.