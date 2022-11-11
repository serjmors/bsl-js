if (typeof window === 'undefined')
    throw new Error("Нельзя использовать bsl-js не в броузере!")

// Состояние последнего события.
// Заполняется при генерации события,
// 1С получает это значение в колбэке при отработке события.
let listeners = {};
let eventDefinitions = {}

const exportedInterfaceEventElement = document.createElement("button");
exportedInterfaceEventElement.style.display = 'none';
exportedInterfaceEventElement.id = 'exportedInterfaceEventElement'
document.body.appendChild(exportedInterfaceEventElement)
console.debug('Integration context initialized')

// Генерация исходящего события для 1С.
// В 1С будет вызван соответствующий колбэк,
// если есть подписка на событие с именем "event_id" или общий обработчик "*"
const send = async function(event_id, data){
    
    console.debug(`Sending event ${event_id} with data:`)
    console.debug(data);
    window.integration_ctx.state = JSON.stringify({
        event: event_id,
        data: data
    }, null, 4)

    exportedInterfaceEventElement.click()

};

// Регистрация события от 1С для страницы.
// При возникновении, сразу все колбэки подключенные к событию.
const receive = async function(event_id, data){

    let dataObj = {};
    if (typeof data === "object")
        dataObj = data;
    else
        dataObj = JSON.parse(data);

    console.debug(`Received event ${event_id} with data:`);
    console.debug(data);
    if (!listeners || !listeners[event_id]){
        console.debug(`No listeners for ${event_id} event id`)
        return;
    }

    listeners[event_id].forEach(async callback => {
        await callback(dataObj)
    });
};

// Слушать входящее событие из 1С
const listen = function(event_id, callback){
    listeners[event_id] = [...(listeners[event_id] || []), callback]
};

const dispatch = function(){
    window.integration_ctx.state = undefined
};

const getListeners = function(){
    return listeners;
};

const registerEvents = function(events){
    eventDefinitions = events;
};

const generate1CModule = function(elName){

    if (!eventDefinitions)
        throw new Error("No events definition was provided. Use registerEvents() function to register definition");
    
    if (!elName) elName = "<Имя элемента HTML-поля>"

    // Генерируем обработчики событий элемента HTML поля.
    return [["#Область ОписаниеПеременных\n",
                "&НаКлиенте",
                "Перем ПодпискиНаСобытияJS Экспорт;\n",      
                "#КонецОбласти"
        ].join("\n")
    ,
        [
        `#Область ОбработчикиСобытийПоля${elName}\n`,
        "&НаКлиенте",
        `Процедура ${elName}ПриНажатии(Элемент, ДанныеСобытия, СтандартнаяОбработка)\n`,
        "   Если ВебСтраницыКлиент.ОбработатьСобытиеJS(ЭтотОбъект, Элемент, ДанныеСобытия) Тогда",
        "       СтандартнаяОбработка = Ложь;",
        "   КонецЕсли;\n",
        "КонецПроцедуры\n",
        "&НаКлиенте",
        `Процедура ${elName}ДокументСформирован(Элемент)\n`,
        ...generateListenersRegistration(),
        "КонецПроцедуры\n",
        ...generateListenersHandlers(),
        "#КонецОбласти\n"
        ].join("\n")
    ].join("\n\n")
    
};

const generateListenersRegistration = () => {

    const template = item => `\tВебСтраницыКлиент.ПодписатьсяНаСобытиеJS(\n\t\tЭтотОбъект,\n\t\t"${item.id}",\n\t\t"Подключаемый_${item.id}",\n\t\tЭлемент\n\t);\n`
    return eventDefinitions.events.map(
         item => template(item)
    ) 
};

const generateListenersHandlers = () => {
    const dataTemplate = item => {
        if (!item.data) return "";
        const paramTemplate = param => `\t//  ${param.name} - ${param.desc}`;
        const res = ["\t// Описание структуры \"Данные\":\n"];
        for (const [name, definition] of Object.entries(item.data))
            res.push(paramTemplate({name: name, ...definition}));
        return res.join("");    
    }
    const template = item => `&НаКлиенте\nПроцедура Подключаемый_${item.id}(Данные, Поле = Неопределено) Экспорт\n${dataTemplate(item)}\n\nКонецПроцедуры\n`
    
    return eventDefinitions.events.map( 
        item => template(item) 
    )

};

listen("СгенерироватьМодульФормы", data => {
    send("ПриГенерацииМодуляФормы", {"content": generate1CModule()})
});

// Обязательно крепим к окну специальный объект 
// для работы 1С-ной части библиотеки
window.integration_ctx = {
    send, receive, dispatch, state: undefined
}

export {
    send as sendTo1C,
    listen as listenFrom1C,
    registerEvents
}
