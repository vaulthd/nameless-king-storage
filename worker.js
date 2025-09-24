/*** HTML TRANSFORMERS ***/
class HTMLFileValue {
  constructor(url) {
    this.url = url;
  }
  element(el) {
    el.setAttribute("value", this.url);
  }
}

class HTMLCaptchaSiteKey {
  constructor(sitekey) {
    this.sitekey = sitekey;
  }
  element(el) {
    el.setAttribute("data-sitekey", this.sitekey);
  }
}

class HTMLFormLocation {
  constructor(action) {
    this.action = action;
  }
  element(el) {
    el.setAttribute("action", this.action);
  }
}

/*** RETURN HELPERS ***/
async function getLocalFile(env, origin, file) {
  return await env.ASSETS.fetch(new Request(origin + file));
}
async function returnNotFound(env, origin) {
  const errorPage = await getLocalFile(env, origin, "/notfound.html");
  return new Response(await errorPage.text(), {headers: new Headers({"content-type": "text/html"}), status: 404});
}
async function returnBadCaptcha(env, origin) {
  const errorPage = await getLocalFile(env, origin, "/badcaptcha.html");
  return new Response(await errorPage.text(), {headers: new Headers({"content-type": "text/html"}), status: 401});
}
async function serveFileFromPath(env, origin, path) {
  if (path == null)
    return await returnNotFound(env, origin);

  const file = await env.FILE_STORE.get(path);
  if (!file)
    return await returnNotFound(env, origin);

  // Serve the files.
  return new Response(file.body, {
    headers: { 
      "Content-Type": file.httpMetadata.contentType,
      "Content-Disposition": `attachment; filename=${path}`
    },
  });
}

/* Handles file storage for sharing random files */
export default {
  async fetch(request, env, ctx) {
    const {pathname, origin} = new URL(request.url);

    // Early out for the stylesheet
    if (pathname === "/pico.min.css") {
      return await getLocalFile(env, origin, pathname);
    }
    
    // If sharing is not enabled, then serve 404s
    if (env.SHARE_ENABLED !== "true") {
      return await returnNotFound(env, origin);
    }
    const method = request.method;

    // lambda for getting parameters
    let getParameter = function(params, key) {
      if (!params.has(key) || params.get(key).length == 0)
          return null;

      return params.get(key);
    };
    
    // Allow for if captcha is disabled.
    if (env.REQUIRE_CAPTCHA === "false") {
      const path = pathname.replace(env.FILES_PATH, "").trim();
      return await serveFileFromPath(env, origin, path);
    }

    if (method === "GET") {
      // Always ask the user for HTML Captcha before continuing.
      const path = pathname.replace(env.FILES_PATH, "").trim();
      // If the user specified no files, then just give them a not found.
      // TODO: perhaps make an index in the future.
      if (path === "") {
        return await returnNotFound(env, origin);
      }
      const mainHTML = await getLocalFile(env, origin, "/captcha.html");
      return new HTMLRewriter().on('#fileLoc', new HTMLFileValue(path))
        .on(".cf-turnstile", new HTMLCaptchaSiteKey(env.CAPTCHA_SITE_KEY))
        .on("form", new HTMLFormLocation(env.FILES_PATH))
        .transform(mainHTML);
        
      } else if (method === "POST") {
        const formData = await request.formData();
        const token = getParameter(formData, "cf-turnstile-response");
        if (token === null) {
          return await returnBadCaptcha(env, origin);  
        }
        const ip = request.headers.get('CF-Connecting-IP');
    
        // Go check on the captcha to make sure it's valid
        let verifyCatchaData = new FormData();
        verifyCatchaData.append('secret', env.CAPTCHA_PRIV_KEY);
        verifyCatchaData.append('response', token);
        verifyCatchaData.append('remoteip', ip);
    
        const catchaVerify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            body: verifyCatchaData,
            method: 'POST',
        });
        const captchaVerifyResult = await catchaVerify.json();
        // If it fails to captcha validate, just tell them no file exists.
        if (!captchaVerifyResult.success) {
          return await returnBadCaptcha(env, origin);  
        } else {
          // Otherwise try to get the files.
          const path = getParameter(formData, "file");
          return await serveFileFromPath(env, origin, path);
        }
      }
    
    return await returnNotFound(env, origin);
  },
};