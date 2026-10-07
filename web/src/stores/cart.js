import { defineStore } from 'pinia';

const KEY = 'cart_items';

export const useCartStore = defineStore('cart', {
  state: () => ({
    items: JSON.parse(localStorage.getItem(KEY) || '[]')
  }),
  getters: {
    totalCount: (s) => s.items.length,
    totalAmount: (s) => s.items.reduce((sum, i) => sum + Number(i.price), 0)
  },
  actions: {
    save() {
      localStorage.setItem(KEY, JSON.stringify(this.items));
    },
    add(item) {
      if (!this.items.some((i) => i.id === item.id)) {
        this.items.push({ id: item.id, title: item.title, price: item.price, tech: item.tech });
        this.save();
      }
    },
    remove(id) {
      this.items = this.items.filter((i) => i.id !== id);
      this.save();
    },
    updatePrice(id, price) {
      const item = this.items.find((i) => i.id === id);
      if (item) {
        item.price = price;
        this.save();
      }
    },
    clear() {
      this.items = [];
      this.save();
    }
  }
});
