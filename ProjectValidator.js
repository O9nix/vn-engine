import { validateProjectScenes } from './project-validator.js';


/**
 * @class ProjectValidator
 * @apiGroup ProjectValidator
 * Проверяет проект на типовые и базовые ошибки. Такие как:
 * 1. Метка (goto) не ведет ни к одному из существующих узлов
 */
export class ProjectValidator {
    #project;
    #bus
    /**
     * @apiName constructor
     * @apiGroup ProjectValidator
     * Получает проект для валидации
     * @param {project} project 
     */
    constructor(project,bus) {
        this.#project = project;
        this.#bus = bus
    }

/**
 * @apiName ProjectValidator.validateGotos
 * @apiGroup ProjectValidator
 *
 * Проверяет метки goto
 *
 * @example Возвращает объект 
 * 
 * const validator = new ProjectValidator(project);
 * const result = validator.validateGotos();
 * //Возвращяет объект
 *{
  *   valid: boolean,       // прошла ли валидация успешно
  *   hasGoto: boolean,     // найден ли хотя бы один goto
  *   gotoCount: number,    // сколько всего найдено goto
  *   nodeCount: number,    // сколько уникальных узлов найдено
  *   errors: Array<{       // список ошибок
  *       target: any,
  *       path: string,
  *       message: string
  *   }>
 *}
 * 



 */
    validateGotos() {
        const scenes =
            typeof this.#project?.getScenes === 'function'
                ? this.#project.getScenes()
                : this.#project?.scenes;
        let data= validateProjectScenes(scenes);
        console.log('ошибочки',data)
        if(data.errors)  this.#bus.emit('validator:errors',{'errors': data.errors})
            
            return data

        
       
    }
}