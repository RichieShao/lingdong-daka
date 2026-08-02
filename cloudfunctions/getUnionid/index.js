// 云函数 getUnionid —— 取得跨端统一身份（unionid）
// 仅当 H5 在微信内通过公众号 OAuth 拿到 code 时，前端才会调用本函数（script.js 中 CLOUD_MP_APPID 非空才会触发）。
// 部署到 CloudBase 时，需在函数配置里设置环境变量 MP_APPID、MP_SECRET（公众号的 AppID / AppSecret）。
const cloudbase = require('@cloudbase/node-sdk');
const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const https = require('https');

// 用公众号 OAuth code 换取 access_token（内含 openid，绑定开放平台时含 unionid）
function exchangeCode(code) {
  const appid = process.env.MP_APPID;
  const secret = process.env.MP_SECRET;
  if (!appid || !secret) return Promise.resolve({ errcode: 'no_config' });
  const url = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${appid}&secret=${secret}&code=${code}&grant_type=authorization_code`;
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

exports.main = async (event) => {
  // H5 网页：用 OAuth code 换 openid + unionid
  if (event && event.code) {
    try {
      const token = await exchangeCode(event.code);
      if (token && token.openid) {
        return {
          ok: true,
          unionid: token.unionid || token.openid, // 未绑定开放平台时退化用 openid
          openid: token.openid,
          from: 'web',
          fallback: !token.unionid,
        };
      }
      return { ok: false, err: 'exchange_failed', detail: token };
    } catch (e) {
      return { ok: false, err: String((e && e.message) || e) };
    }
  }
  return { ok: false, err: 'no_code' };
};
