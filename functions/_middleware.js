export async function onRequest(context) {
    const url = new URL(context.request.url);
    
    // Redirect everything to your new site, keeping any path or query parameters
    const targetUrl = new URL(url.pathname + url.search, 'https://oshimy.pages.dev');
    
    return Response.redirect(targetUrl.toString(), 301);
}
