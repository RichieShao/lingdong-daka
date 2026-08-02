// 云函数 pull —— 拉取用户云端数据（以 uid 为文档主键）
// 契约：前端 callFunction({ name:'pull', data:{ uid } }) → { ok, data, updatedAt }
const cloudbase = require('@cloudbase/node-sdk');
const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const db = app.database();

// 取调用方真实身份（CloudBase 匿名/自定义登录用户），用于越权防护
async function callerUid() {
  try {
    const info = await app.auth().getEndUserInfo();
    return (info && info.userInfo && info.userInfo.uid) || '';
  } catch (e) {
    return '';
  }
}

exports.main = async (event) => {
  let uid = (event && event.uid) || '';
  const real = await callerUid();
  if (real) {
    // 调用方身份优先；若前端传了 uid 且与调用方不一致，视为越权
    if (uid && uid !== real) return { ok: false, err: 'forbidden' };
    uid = real;
  }
  if (!uid) return { ok: false, err: 'no_uid' };
  try {
    const r = await db.collection('sync').doc(uid).get();
    const doc = r.data;
    return { ok: true, data: doc ? doc.data : null, updatedAt: doc ? doc.updatedAt : 0 };
  } catch (e) {
    // 文档不存在视为空数据（新用户首次拉取）
    return { ok: true, data: null, updatedAt: 0 };
  }
};
