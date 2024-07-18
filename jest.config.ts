import { type JestConfigWithTsJest } from 'ts-jest';
const config: JestConfigWithTsJest = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    moduleFileExtensions: ['js', 'ts'],
    transform: {
        '^.+\\.ts$': [
            'ts-jest',
            {
                tsconfig: './test/tsconfig.json'
            }
        ]
    },
    moduleNameMapper: {
      '^(\\.{1,2}/.*)\\.js$': '$1'
    },
    testMatch: [
        '**/test/**/*.test.ts'
    ]
};

export default config;
