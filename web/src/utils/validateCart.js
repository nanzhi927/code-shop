import { ElMessage } from 'element-plus';
import http from '../api';

export async function validateCartItems(cartStore) {
  if (!cartStore.items.length) return;
  let changed = false;
  for (const item of [...cartStore.items]) {
    try {
      const p = await http.get(`/products/${item.id}`);
      // 缺省 status 视为在售（详情接口可能不返回该字段）；仅 status===0 判下架
      if (!p || Number(p.status) === 0) {
        cartStore.remove(item.id);
        ElMessage.warning(`「${item.title}」已下架，已从购物车移除`);
        changed = true;
        continue;
      }
      if (Number(p.price) !== Number(item.price)) {
        cartStore.updatePrice(item.id, p.price);
        ElMessage.info(`「${item.title}」价格已更新`);
        changed = true;
      }
    } catch {
      cartStore.remove(item.id);
      ElMessage.warning(`「${item.title}」已不存在，已从购物车移除`);
      changed = true;
    }
  }
  return changed;
}
