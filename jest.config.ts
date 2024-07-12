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
    testMatch: [
        '**/test/**/*.test.ts'
    ]
};

export default config;
