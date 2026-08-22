/**
 * jest 設定は CJS で置く。
 * TS 設定ファイルにすると ts-jest の legacy config パーサ経路に入り、jest 30 では解決されない
 * 依存 (jest-util) を要求してテストが起動しない。
 * @type {import('jest').Config}
 */
module.exports = {
    testEnvironment: 'node',
    moduleFileExtensions: ['js', 'ts'],
    transform: {
        '^.+\\.ts$': ['ts-jest', { tsconfig: './test/tsconfig.json' }],
    },
    // ソースは ESM 形式 (`./foo.js` 拡張子付き import) のため、CJS transform 時に .ts へ解決し直す
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },
    testMatch: ['**/test/**/*.test.ts'],
};
