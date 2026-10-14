import Quill from "quill";
import { TableToolbar } from "../types";

type EventHandler = (event: Event) => void;
type MouseEventHandler = (event: MouseEvent) => void;

// Static registry to track all active table instances
class GlobalEventsRegistry {
    private static activeInstance : Quill | null = null;
    private static instances: Set<Quill> = new Set();
    private static globalListeners: Map<string, Map<Quill, EventHandler>> = new Map();
    private static onEnterFocus: Map<Quill, MouseEventHandler> = new Map();
    private static onExitFocus: Map<Quill, MouseEventHandler> = new Map();

    static registerNewInstance(instance: Quill, handlersByEvent: Map<string, EventHandler>, onEnterFocus: MouseEventHandler | null = null, onExitFocus: MouseEventHandler | null = null): void {
        if (this.instances.size === 0) {
            document.addEventListener('mousedown', this.cellSelectionMouseDownHandler.bind(this));
            this.activeInstance = instance;
        }
        this.instances.add(instance);
        if (onEnterFocus) this.onEnterFocus.set(instance, onEnterFocus);
        if (onExitFocus) this.onExitFocus.set(instance, onExitFocus);
        
        this.attachGlobalListeners(instance, handlersByEvent);
    }

    static unregisterInstance(instance: Quill): void {
        this.detachGlobalListeners(instance);

        this.instances.delete(instance);
        if (this.instances.size === 0) {
            document.removeEventListener('mousedown', this.cellSelectionMouseDownHandler.bind(this));
            this.activeInstance = null;
        }
        if (this.onEnterFocus.has(instance)) this.onEnterFocus.delete(instance);
        if (this.onExitFocus.has(instance)) this.onExitFocus.delete(instance);
    }

    private static attachGlobalListeners(instance: Quill, handlersByEvent: Map<string, EventHandler>): void {
        handlersByEvent.forEach((handler, event) => {
            if (!this.globalListeners.has(event)) {
                this.globalListeners.set(event, new Map());
                document.addEventListener(event, this.globalEventHandler.bind(this));
            }
            if (this.globalListeners.get(event)!.get(instance)) {
                console.warn(`Handler for event "${event}" already exists for this instance. Overwriting.`);
            }
            this.globalListeners.get(event)!.set(instance, handler);
        });
    }

    private static detachGlobalListeners(instance: Quill): void {
        this.globalListeners.forEach((handlers, event) => {
            handlers.delete(instance);
            if (handlers.size === 0) {
                this.globalListeners.delete(event);
                document.removeEventListener(event, this.globalEventHandler.bind(this));
            }
        });
    }

    private static globalEventHandler(event: Event): void {
        if (!this.activeInstance) return;
        this.globalListeners.get(event.type)?.get(this.activeInstance)?.(event);
    }

    private static cellSelectionMouseDownHandler(event: MouseEvent): void {
        const path = event.composedPath();
        for (const instance of this.instances) {
            const pathIncludesQuillContainer = path.includes(instance.container);
            const toolbar: TableToolbar | null | undefined = instance.getModule('toolbar') as TableToolbar | null | undefined;
            const pathIncludesToolbar = toolbar?.container ? path.includes(toolbar.container) : false;

            if (pathIncludesQuillContainer || pathIncludesToolbar) {
                this.activeInstance = instance;
                this.onEnterFocus.get(instance)?.(event);
                return;
            } else if (instance === this.activeInstance) {
                this.activeInstance = null;
                this.onExitFocus.get(instance)?.(event);
                return;
            }
        }
    }
}

export default GlobalEventsRegistry;