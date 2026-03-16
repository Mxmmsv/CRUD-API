# CRUD-API

## Aliases

The project supports the `@/` alias for imports from `src`.

```ts
import { appName } from '@/app.js';
```

TypeScript resolves the alias from `tsconfig.json`, and `tsc-alias` rewrites it to relative paths in `dist` after build.
