/* not type checking this file because flow doesn't play well with Proxy */

/**
 * initProxy的作用：
 * 1、在环境中支持Proxy对象的时候，给vm._renderProxy增加了一个代理（其中_renderProxy是在render.js中使用）；如果不支持Proxy，则直接设置vm._renderProxy=vm
 * 2、代理的作用：主要用于在开发阶段，对render函数中对vm实例上属性访问的一个校验
 * 校验内容：
 *  校验render中是否引用了vm上不存在的数据或非特许的数据
 *  校验自定义的快捷键名是否和Vue内置的快捷键修饰符重名
 */
import config from 'core/config'
import { warn, makeMap, isNative } from '../util/index'

let initProxy

if (process.env.NODE_ENV !== 'production') {
  const allowedGlobals = makeMap(
    'Infinity,undefined,NaN,isFinite,isNaN,' +
    'parseFloat,parseInt,decodeURI,decodeURIComponent,encodeURI,encodeURIComponent,' +
    'Math,Number,Date,Array,Object,Boolean,String,RegExp,Map,Set,JSON,Intl,' +
    'require' // for Webpack/Browserify
  )

  const warnNonPresent = (target, key) => {
    warn(
      `Property or method "${key}" is not defined on the instance but ` +
      'referenced during render. Make sure that this property is reactive, ' +
      'either in the data option, or for class-based components, by ' +
      'initializing the property. ' +
      'See: https://vuejs.org/v2/guide/reactivity.html#Declaring-Reactive-Properties.',
      target
    )
  }

  // 以$和_的属性不会被代理到vue实例上，是为了避免和Vue内部定义的属性冲突，对于自己定义的以$或者是_开头的属性，只能用$data.key的形式来访问
  const warnReservedPrefix = (target, key) => {
    warn(
      `Property "${key}" must be accessed with "$data.${key}" because ` +
      'properties starting with "$" or "_" are not proxied in the Vue instance to ' +
      'prevent conflicts with Vue internals. ' +
      'See: https://vuejs.org/v2/api/#data',
      target
    )
  }

  const hasProxy =
    typeof Proxy !== 'undefined' && isNative(Proxy)

  /**
   *vue提供了通过Vue.config来定义config.keyCodes,然后在模板中直接使用修饰符的语法糖，如：
   * Vue.config.keyCodes = {
      f1 : 112,
      'arrow-up' : [38, 87],  // kebab-case instead of camelCase
    };

       // 调用
       @keyup.f1="handleF1"
       @keydown.arrow-up="handleArrowUp"
   下面代码就是为了校验自定义的修饰符是否覆盖了Vue内置的修饰符
   */

  if (hasProxy) {
    const isBuiltInModifier = makeMap('stop,prevent,self,ctrl,shift,alt,meta,exact')
    config.keyCodes = new Proxy(config.keyCodes, {
      set (target, key, value) {
        if (isBuiltInModifier(key)) {
          warn(`Avoid overwriting built-in modifier in config.keyCodes: .${key}`)
          return false
        } else {
          target[key] = value
          return true
        }
      }
    })
  }

  // 枚举属性时做校验
  const hasHandler = {
    has (target, key) {
      const has = key in target
      const isAllowed = allowedGlobals(key) ||
        (typeof key === 'string' && key.charAt(0) === '_' && !(key in target.$data))
      if (!has && !isAllowed) {
        if (key in target.$data) warnReservedPrefix(target, key)
        else warnNonPresent(target, key)
      }
      return has || !isAllowed
    }
  }

  // 判断从vue实例上访问属性时，做校验
  const getHandler = {
    get (target, key) {
      if (typeof key === 'string' && !(key in target)) {
        if (key in target.$data) warnReservedPrefix(target, key)
        else warnNonPresent(target, key)
      }
      return target[key]
    }
  }

  initProxy = function initProxy (vm) {
    if (hasProxy) {
      // determine which proxy handler to use
      const options = vm.$options
      const handlers = options.render && options.render._withStripped
        ? getHandler
        : hasHandler
      vm._renderProxy = new Proxy(vm, handlers)
    } else {
      vm._renderProxy = vm
    }
  }
}

export { initProxy }
