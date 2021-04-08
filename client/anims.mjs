function cssAnim(el, anim) {
    el.preventDefault;
    el.classList.remove(anim);
    void el.offsetWidth;
    el.classList.add(anim);
}

export function shake(el) {
    cssAnim(el, 'shake');
}