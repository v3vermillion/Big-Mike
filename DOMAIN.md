# Domain configuration

**Live:** GitHub Pages project URL — `https://v3vermillion.github.io/Big-Mike/`
SEO (canonical, og:url, og:image, twitter, JSON-LD), `sitemap.xml`, and
`robots.txt` point here.

**Preserved (not eliminated):** the Namecheap custom domain `ifbbprobigmikeely.com`
is kept in `CNAME.disabled`. To restore it once DNS is resolved:
1. `git mv CNAME.disabled CNAME`  (re-activates the custom domain on Pages)
2. Repoint SEO back:
   `sed -i 's#https://v3vermillion.github.io/Big-Mike#https://ifbbprobigmikeely.com#g' *.html sitemap.xml robots.txt`
   (and drop the `/Big-Mike` path segment if the custom domain serves at root)
