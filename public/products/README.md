# Product images

Catalog images are served from **Cloudinary** (`res.cloudinary.com/diqkh6yqr/...`).

Do not commit large local dumps here — they blow macOS file-watcher limits (`EMFILE`) and crash `next dev`. Local audit copies live outside the repo at `../.product-assets/admin-products` if you need them.
