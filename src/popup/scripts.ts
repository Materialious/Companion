import {mount} from 'svelte'
import PopupApp from './PopupApp.svelte'
import './styles.css'

const container = document.getElementById('app')
if (container) mount(PopupApp, {target: container})
